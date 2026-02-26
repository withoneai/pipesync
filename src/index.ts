/**
 * pipesync - Dynamic data sync engine for Pica-connected platforms
 */

// Engine
export { pull } from "./engine.js";

// State management
export {
  isInitialized,
  loadConfig,
  saveConfig,
  saveMapping,
  loadMapping,
  listMappings,
  removeMapping,
  loadState,
  saveState,
} from "./state.js";

// Pica client
export { picaRequest, picaRequestUrl } from "./pica-client.js";

// Mapping utilities
export { resolve, applyMapping, extractId, buildExternalUrl } from "./mapping.js";

// Pagination
export { extractPage, applyCursor } from "./pagination.js";

// Output adapters
export { MemOutput } from "./output/mem.js";
export { StdoutOutput } from "./output/stdout.js";
export type { SyncOutput } from "./output/interface.js";

// Types
export type {
  SyncMapping,
  SyncState,
  SyncConfig,
  SyncResult,
  PaginationType,
  PaginationConfig,
  IncrementalConfig,
} from "./types.js";
