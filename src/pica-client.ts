/**
 * Pica passthrough HTTP client
 *
 * Uses the 3-header model:
 *   x-pica-secret: API key
 *   x-pica-connection-key: Connection identifier
 *   x-pica-action-id: Action identifier
 */

export interface PicaRequestOptions {
  secretKey: string;
  connectionKey: string;
  actionId: string;
  baseUrl?: string;
  method?: string;
  path?: string;
  queryParams?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface PicaResponse {
  data: unknown;
  headers: Record<string, string>;
  status: number;
}

const DEFAULT_BASE_URL = "https://api.picaos.com";

/**
 * Make a request through the Pica passthrough API.
 */
export async function picaRequest(options: PicaRequestOptions): Promise<PicaResponse> {
  const {
    secretKey,
    connectionKey,
    actionId,
    baseUrl = DEFAULT_BASE_URL,
    method = "GET",
    path = "",
    queryParams = {},
    body,
    headers: extraHeaders = {},
  } = options;

  // Build URL with query params
  const url = new URL(`/v1/passthrough${path}`, baseUrl);
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  // Build headers
  const headers: Record<string, string> = {
    "x-pica-secret": secretKey,
    "x-pica-connection-key": connectionKey,
    "x-pica-action-id": actionId,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && method !== "GET") {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), fetchOptions);

  // Extract response headers
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key.toLowerCase()] = value;
  });

  let data: unknown;
  const text = await response.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Pica API error ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`
    );
  }

  return {
    data,
    headers: responseHeaders,
    status: response.status,
  };
}

/**
 * Make a request to a full URL (for link-header pagination).
 */
export async function picaRequestUrl(
  fullUrl: string,
  secretKey: string,
  connectionKey: string,
  actionId: string
): Promise<PicaResponse> {
  const headers: Record<string, string> = {
    "x-pica-secret": secretKey,
    "x-pica-connection-key": connectionKey,
    "x-pica-action-id": actionId,
    "Content-Type": "application/json",
  };

  const response = await fetch(fullUrl, { headers });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key.toLowerCase()] = value;
  });

  let data: unknown;
  const text = await response.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Pica API error ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`
    );
  }

  return { data, headers: responseHeaders, status: response.status };
}
