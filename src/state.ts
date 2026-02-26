/**
 * File-based state management for sync mappings and state
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import type { SyncMapping, SyncState, SyncConfig } from "./types.js";

const SYNC_DIR = ".pipesync";
const MAPPINGS_DIR = "mappings";
const STATE_DIR = "state";
const CONFIG_FILE = "config.json";

function ensureDirs(baseDir: string): void {
  mkdirSync(join(baseDir, SYNC_DIR, MAPPINGS_DIR), { recursive: true });
  mkdirSync(join(baseDir, SYNC_DIR, STATE_DIR), { recursive: true });
}

function syncDir(baseDir: string): string {
  return join(baseDir, SYNC_DIR);
}

// =============================================================================
// Config
// =============================================================================

export function loadConfig(baseDir: string): SyncConfig {
  const configPath = join(syncDir(baseDir), CONFIG_FILE);
  if (!existsSync(configPath)) {
    return { picaBaseUrl: "https://api.picaos.com", memConfigured: false };
  }
  return JSON.parse(readFileSync(configPath, "utf8"));
}

export function saveConfig(baseDir: string, config: SyncConfig): void {
  ensureDirs(baseDir);
  writeFileSync(
    join(syncDir(baseDir), CONFIG_FILE),
    JSON.stringify(config, null, 2)
  );
}

export function isInitialized(baseDir: string): boolean {
  return existsSync(join(syncDir(baseDir), CONFIG_FILE));
}

// =============================================================================
// Mappings
// =============================================================================

export function saveMapping(baseDir: string, mapping: SyncMapping): void {
  ensureDirs(baseDir);
  writeFileSync(
    join(syncDir(baseDir), MAPPINGS_DIR, `${mapping.name}.json`),
    JSON.stringify(mapping, null, 2)
  );
}

export function loadMapping(baseDir: string, name: string): SyncMapping | null {
  const path = join(syncDir(baseDir), MAPPINGS_DIR, `${name}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function listMappings(baseDir: string): string[] {
  const dir = join(syncDir(baseDir), MAPPINGS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

export function removeMapping(baseDir: string, name: string): boolean {
  const mappingPath = join(syncDir(baseDir), MAPPINGS_DIR, `${name}.json`);
  const statePath = join(syncDir(baseDir), STATE_DIR, `${name}.json`);

  if (!existsSync(mappingPath)) return false;

  unlinkSync(mappingPath);
  if (existsSync(statePath)) unlinkSync(statePath);
  return true;
}

// =============================================================================
// State
// =============================================================================

export function loadState(baseDir: string, name: string): SyncState {
  const path = join(syncDir(baseDir), STATE_DIR, `${name}.json`);
  if (!existsSync(path)) {
    return {
      lastSyncAt: null,
      lastCursor: null,
      syncToken: null,
      totalSynced: 0,
      lastRunRecords: 0,
      status: "idle",
      lastError: null,
    };
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

export function saveState(baseDir: string, name: string, state: SyncState): void {
  ensureDirs(baseDir);
  writeFileSync(
    join(syncDir(baseDir), STATE_DIR, `${name}.json`),
    JSON.stringify(state, null, 2)
  );
}
