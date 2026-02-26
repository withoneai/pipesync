/**
 * Pagination handlers for different API patterns
 */

import type { PaginationConfig } from "./types.js";
import { resolve } from "./mapping.js";

export interface PaginationResult {
  items: Record<string, unknown>[];
  nextCursor: string | null;
  done: boolean;
}

/**
 * Extract items and next cursor from an API response based on pagination config.
 */
export function extractPage(
  response: unknown,
  config: PaginationConfig,
  headers?: Record<string, string>
): PaginationResult {
  if (!response || typeof response !== "object") {
    return { items: [], nextCursor: null, done: true };
  }

  const responseObj = response as Record<string, unknown>;

  // Extract items from the response
  let items: Record<string, unknown>[];
  if (config.itemsField) {
    const raw = resolve(responseObj, config.itemsField);
    items = Array.isArray(raw) ? raw : [];
  } else if (Array.isArray(response)) {
    items = response as Record<string, unknown>[];
  } else {
    items = [];
  }

  // Determine next cursor based on pagination type
  let nextCursor: string | null = null;
  let done = false;

  switch (config.type) {
    case "cursor": {
      if (config.responseField) {
        const cursor = resolve(responseObj, config.responseField);
        nextCursor = cursor ? String(cursor) : null;
      }
      done = !nextCursor;
      break;
    }

    case "offset": {
      // Offset pagination: done when items returned < pageSize
      const pageSize = config.pageSize || 100;
      if (items.length < pageSize) {
        done = true;
      } else {
        // The "cursor" for offset is the next offset value
        nextCursor = "continue";
      }
      break;
    }

    case "sync-token": {
      if (config.responseField) {
        const token = resolve(responseObj, config.responseField);
        nextCursor = token ? String(token) : null;
      }
      // For sync tokens, if there are items we might have more
      done = items.length === 0 && !nextCursor;
      break;
    }

    case "link-header": {
      // Parse Link header: <url>; rel="next"
      const linkHeader = headers?.["link"] || headers?.["Link"] || "";
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) {
        nextCursor = nextMatch[1];
      }
      done = !nextCursor;
      break;
    }

    case "page-number": {
      const pageSize = config.pageSize || 100;
      if (items.length < pageSize) {
        done = true;
      } else {
        nextCursor = "continue";
      }
      break;
    }

    case "none": {
      done = true;
      break;
    }
  }

  return { items, nextCursor, done };
}

/**
 * Apply pagination cursor to request params.
 * Returns updated query params with the cursor applied.
 */
export function applyCursor(
  queryParams: Record<string, unknown>,
  config: PaginationConfig,
  cursor: string | null,
  currentOffset: number
): Record<string, unknown> {
  if (!cursor && config.type !== "offset" && config.type !== "page-number") {
    return queryParams;
  }

  const params = { ...queryParams };

  switch (config.type) {
    case "cursor": {
      if (cursor && config.requestParam) {
        params[config.requestParam] = cursor;
      }
      break;
    }

    case "offset": {
      if (config.requestParam) {
        params[config.requestParam] = currentOffset;
      }
      break;
    }

    case "sync-token": {
      if (cursor && config.requestParam) {
        params[config.requestParam] = cursor;
      }
      break;
    }

    case "page-number": {
      if (config.requestParam) {
        const page = Math.floor(currentOffset / (config.pageSize || 100)) + 1;
        params[config.requestParam] = page;
      }
      break;
    }

    // link-header: the cursor IS the full URL, handled by the engine
    // none: no pagination needed
  }

  return params;
}
