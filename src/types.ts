/**
 * pipesync type definitions
 */

// =============================================================================
// Mapping Config (what the AI generates)
// =============================================================================

export interface SyncMapping {
  name: string;
  platform: string;
  connectionKey: string;
  actionId: string;

  request: {
    method?: string;
    path?: string;
    queryParams?: Record<string, unknown>;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  };

  pagination: PaginationConfig;

  /** Optional detail endpoint for fetching full records */
  detail?: {
    actionId: string;
    path: string;
    pathVar: string;
    idField: string;
    queryParams?: Record<string, unknown>;
  };

  record: {
    type: string;
    mapping: Record<string, string>;
    tags?: string[];
    /** Key templates for dedup: "person:{email}", "attio:{id}" */
    naturalKeys?: string[];
  };

  externalRef: {
    system: string;
    idField: string;
    urlTemplate?: string;
  };

  incremental?: IncrementalConfig;
}

// =============================================================================
// Pagination
// =============================================================================

export type PaginationType =
  | "cursor"
  | "offset"
  | "sync-token"
  | "link-header"
  | "page-number"
  | "none";

export interface PaginationConfig {
  type: PaginationType;
  /** Where to put the cursor/offset/page in the request */
  requestParam?: string;
  /** Where to find the next cursor in the response */
  responseField?: string;
  /** Where the items array lives in the response */
  itemsField?: string;
  /** Page size (for offset/page-number) */
  pageSize?: number;
}

// =============================================================================
// Incremental Sync
// =============================================================================

export interface IncrementalConfig {
  type: "query-filter" | "sync-token" | "sort-filter";
  /** Query param name to set */
  param?: string;
  /** Template with placeholders like {lastSyncDate}, {syncToken} */
  template?: string;
  /** Field in response containing the sync token */
  tokenField?: string;
}

// =============================================================================
// Sync State (persisted between runs)
// =============================================================================

export interface SyncState {
  lastSyncAt: string | null;
  lastCursor: string | null;
  syncToken: string | null;
  totalSynced: number;
  lastRunRecords: number;
  status: "idle" | "running" | "completed" | "error";
  lastError: string | null;
}

// =============================================================================
// Sync Config (global settings)
// =============================================================================

export interface SyncConfig {
  picaSecretKey?: string;
  picaBaseUrl: string;
  memConfigured: boolean;
}

// =============================================================================
// Sync Results
// =============================================================================

export interface SyncResult {
  name: string;
  new: number;
  updated: number;
  skipped: number;
  errors: number;
  duration: string;
  status: "completed" | "error";
  error?: string;
}

// =============================================================================
// Output Interface (pluggable destination)
// =============================================================================

export interface SyncOutput {
  /** Insert or update a record. Returns the record ID and action taken. */
  upsert(record: {
    type: string;
    data: Record<string, unknown>;
    tags?: string[];
    keys?: string[];
  }): Promise<{ id: string; action: "inserted" | "updated" }>;

  /** Find a record by its external reference. Returns record ID or null. */
  findByRef(system: string, externalId: string): Promise<string | null>;

  /** Add an external reference to a record. */
  addRef(
    recordId: string,
    ref: { system: string; externalId: string; url?: string }
  ): Promise<void>;
}
