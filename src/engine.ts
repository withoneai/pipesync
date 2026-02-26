/**
 * Core sync engine - the deterministic loop
 *
 * No AI at runtime. Reads mapping config, calls Pica, maps fields, stores records.
 */

import type { SyncMapping, SyncState, SyncResult } from "./types.js";
import type { SyncOutput } from "./output/interface.js";
import { picaRequest, picaRequestUrl } from "./pica-client.js";
import { applyMapping, extractId, buildExternalUrl, resolve } from "./mapping.js";
import { extractPage, applyCursor } from "./pagination.js";
import { loadState, saveState } from "./state.js";

export interface EngineOptions {
  baseDir: string;
  secretKey: string;
  picaBaseUrl?: string;
  output: SyncOutput;
  /** Force full sync (ignore incremental state) */
  full?: boolean;
  /** Log progress to console */
  verbose?: boolean;
}

/**
 * Run the sync loop for a single mapping.
 */
export async function pull(
  mapping: SyncMapping,
  options: EngineOptions
): Promise<SyncResult> {
  const { baseDir, secretKey, output, full = false, verbose = false } = options;
  const picaBaseUrl = options.picaBaseUrl || "https://api.picaos.com";
  const startTime = Date.now();

  let state = loadState(baseDir, mapping.name);
  const isFirstRun = !state.lastSyncAt;

  // Mark as running
  state.status = "running";
  state.lastError = null;
  saveState(baseDir, mapping.name, state);

  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let offset = 0;
  let cursor: string | null = null;

  // Resume from saved cursor if not first run and not full resync
  if (!full && !isFirstRun && state.lastCursor) {
    cursor = state.lastCursor;
  }

  try {
    let done = false;

    while (!done) {
      // Build request query params
      let queryParams = { ...(mapping.request.queryParams || {}) };

      // Apply incremental filters (not on first run, not on full resync)
      if (!full && !isFirstRun && mapping.incremental && state.lastSyncAt) {
        queryParams = applyIncrementalFilter(
          queryParams,
          mapping.incremental,
          state
        );
      }

      // Apply pagination cursor
      queryParams = applyCursor(queryParams, mapping.pagination, cursor, offset);

      // For POST requests, merge pagination params into the body
      let body = mapping.request.body ? { ...mapping.request.body } : undefined;
      if (body && mapping.request.method === "POST" && mapping.pagination.requestParam) {
        const paginationValue = queryParams[mapping.pagination.requestParam];
        if (paginationValue !== undefined) {
          body[mapping.pagination.requestParam] = paginationValue;
          // Remove from queryParams since it's going in the body
          delete queryParams[mapping.pagination.requestParam];
        }
      }

      if (verbose) {
        console.log(`  Fetching page (offset=${offset})...`);
      }

      // Make the API request
      let response;

      if (mapping.pagination.type === "link-header" && cursor) {
        // For link-header pagination, cursor is a full URL
        response = await picaRequestUrl(
          cursor,
          secretKey,
          mapping.connectionKey,
          mapping.actionId
        );
      } else {
        response = await picaRequest({
          secretKey,
          connectionKey: mapping.connectionKey,
          actionId: mapping.actionId,
          baseUrl: picaBaseUrl,
          method: mapping.request.method,
          path: mapping.request.path,
          queryParams,
          body,
          headers: mapping.request.headers,
        });
      }

      // Extract items and next cursor
      const page = extractPage(
        response.data,
        mapping.pagination,
        response.headers
      );

      if (verbose) {
        console.log(`  Got ${page.items.length} items`);
      }

      // Process each item
      for (const item of page.items) {
        try {
          // Extract external ID
          const externalId = extractId(item, mapping.externalRef.idField);
          if (!externalId) {
            errorCount++;
            continue;
          }

          // Fetch detail if configured
          let itemData = item;
          if (mapping.detail) {
            try {
              const detailId = extractId(item, mapping.detail.idField);
              if (detailId) {
                const detailPath = mapping.detail.path.replace(
                  `{${mapping.detail.pathVar}}`,
                  detailId
                );

                const detailResponse = await picaRequest({
                  secretKey,
                  connectionKey: mapping.connectionKey,
                  actionId: mapping.detail.actionId,
                  baseUrl: picaBaseUrl,
                  method: "GET",
                  path: detailPath,
                  queryParams: mapping.detail.queryParams,
                });

                if (
                  detailResponse.data &&
                  typeof detailResponse.data === "object"
                ) {
                  itemData = detailResponse.data as Record<string, unknown>;
                }
              }
            } catch {
              // Detail fetch failed, use list data
              if (verbose) {
                console.log(`  Warning: detail fetch failed for ${externalId}`);
              }
            }
          }

          // Map fields
          const mappedData = applyMapping(itemData, mapping.record.mapping);

          // Build keys array for dedup
          const keys: string[] = [];

          // Always add external ref as a key
          keys.push(`${mapping.externalRef.system}:${externalId}`);

          // Resolve natural key templates from mapped data
          if (mapping.record.naturalKeys) {
            for (const template of mapping.record.naturalKeys) {
              const resolved = template.replace(/\{(\w+)\}/g, (_, field) => {
                const val = mappedData[field];
                return val != null ? String(val) : "";
              });
              // Only add if all placeholders were resolved (no empty segments)
              if (resolved && !resolved.includes(":")) {
                // Template like "person:{email}" -> "person:foo@bar.com"
                keys.push(resolved);
              } else if (resolved && !resolved.endsWith(":") && !resolved.includes("::")) {
                keys.push(resolved);
              }
            }
          }

          // Upsert with keys (handles dedup internally)
          const { id: recordId, action } = await output.upsert({
            type: mapping.record.type,
            data: mappedData,
            tags: mapping.record.tags,
            keys,
          });

          // Add external reference for sync metadata
          const externalUrl = mapping.externalRef.urlTemplate
            ? buildExternalUrl(mapping.externalRef.urlTemplate, item)
            : undefined;

          await output.addRef(recordId, {
            system: mapping.externalRef.system,
            externalId,
            url: externalUrl,
          });

          if (action === "updated") {
            updatedCount++;
          } else {
            newCount++;
          }
        } catch (err) {
          errorCount++;
          if (verbose) {
            console.log(`  Error processing item: ${(err as Error).message}`);
          }
        }
      }

      // Update pagination state
      cursor = page.nextCursor;
      offset += page.items.length;
      done = page.done;

      // Save intermediate state (for resume)
      state.lastCursor = cursor;
      saveState(baseDir, mapping.name, state);
    }

    // Save sync token if applicable
    if (
      mapping.incremental?.type === "sync-token" &&
      mapping.incremental.tokenField
    ) {
      // The sync token should have been captured from the last response
      // Already handled by cursor for sync-token pagination type
      state.syncToken = cursor;
    }

    // Finalize state
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    state.lastSyncAt = new Date().toISOString();
    state.lastCursor = null; // Clear cursor on successful completion
    state.totalSynced += newCount;
    state.lastRunRecords = newCount;
    state.status = "completed";
    state.lastError = null;
    saveState(baseDir, mapping.name, state);

    return {
      name: mapping.name,
      new: newCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
      duration: `${duration}s`,
      status: "completed",
    };
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const errorMsg = (err as Error).message;

    state.status = "error";
    state.lastError = errorMsg;
    state.lastRunRecords = newCount;
    saveState(baseDir, mapping.name, state);

    return {
      name: mapping.name,
      new: newCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount + 1,
      duration: `${duration}s`,
      status: "error",
      error: errorMsg,
    };
  }
}

/**
 * Apply incremental sync filters to query params.
 */
function applyIncrementalFilter(
  queryParams: Record<string, unknown>,
  incremental: NonNullable<SyncMapping["incremental"]>,
  state: SyncState
): Record<string, unknown> {
  const params = { ...queryParams };

  switch (incremental.type) {
    case "query-filter": {
      if (incremental.param && incremental.template && state.lastSyncAt) {
        // Format the last sync date for the API
        const lastSyncDate = state.lastSyncAt.split("T")[0]; // YYYY-MM-DD
        const value = incremental.template
          .replace("{lastSyncDate}", lastSyncDate)
          .replace("{lastSyncAt}", state.lastSyncAt);
        params[incremental.param] = value;
      }
      break;
    }

    case "sync-token": {
      if (incremental.param && state.syncToken) {
        params[incremental.param] = state.syncToken;
      }
      break;
    }

    case "sort-filter": {
      // Sort-filter: use the last sync date as a filter
      if (incremental.param && state.lastSyncAt) {
        params[incremental.param] = state.lastSyncAt;
      }
      break;
    }
  }

  return params;
}
