#!/usr/bin/env node
/**
 * pipesync CLI
 *
 * Usage:
 *   pipesync init [--pica-key <key>]
 *   pipesync add <name> --config '<json>'
 *   pipesync list
 *   pipesync show <name>
 *   pipesync pull [name] [--full]
 *   pipesync status
 *   pipesync watch [--interval 30m]
 *   pipesync remove <name>
 *   pipesync update <name> --config '<json>'
 */

import { Command } from "commander";
import pc from "picocolors";
import { readFileSync } from "fs";
import {
  isInitialized,
  loadConfig,
  saveConfig,
  saveMapping,
  loadMapping,
  listMappings,
  removeMapping,
  loadState,
} from "./state.js";
import { pull } from "./engine.js";
import type { SyncOutput } from "./output/interface.js";
import type { SyncMapping } from "./types.js";

async function createOutput(outputType: string): Promise<SyncOutput> {
  switch (outputType) {
    case "mem": {
      const { MemOutput } = await import("./output/mem.js");
      return new MemOutput();
    }
    case "stdout":
    case "json": {
      const { StdoutOutput } = await import("./output/stdout.js");
      return new StdoutOutput();
    }
    default:
      console.error(`Unknown output type: ${outputType}. Use: mem, stdout`);
      process.exit(1);
  }
}

const program = new Command();

program
  .name("pipesync")
  .description("Dynamic data sync engine for Pica-connected platforms")
  .version("0.1.0");

const cwd = process.cwd();

// =============================================================================
// Init
// =============================================================================

program
  .command("init")
  .description("Initialize pipesync in the current directory")
  .option("--pica-key <key>", "Pica secret key")
  .action((options: { picaKey?: string }) => {
    const secretKey =
      options.picaKey ||
      process.env.PICA_SECRET_KEY ||
      process.env.PICA_SECRET;

    saveConfig(cwd, {
      picaSecretKey: secretKey,
      picaBaseUrl: "https://api.picaos.com",
      memConfigured: true,
    });

    console.log(`${pc.green("Initialized")} .pipesync/`);
    if (secretKey) {
      console.log(`Pica key: ${pc.dim("configured")}`);
    } else {
      console.log(
        `${pc.yellow("Note:")} Set PICA_SECRET_KEY env var or run with --pica-key`
      );
    }
    console.log(`\nNext: ${pc.cyan("pipesync add <name> --config '<json>'")} `);
  });

// =============================================================================
// Add
// =============================================================================

program
  .command("add <name>")
  .description("Add a sync mapping")
  .option("-c, --config <json>", "Mapping config as JSON string")
  .option("-f, --config-file <path>", "Mapping config from file")
  .action(
    (name: string, options: { config?: string; configFile?: string }) => {
      let mappingJson: string;

      if (options.configFile) {
        mappingJson = readFileSync(options.configFile, "utf8");
      } else if (options.config) {
        mappingJson = options.config;
      } else {
        console.error("Provide --config or --config-file");
        process.exit(1);
      }

      try {
        const mapping: SyncMapping = JSON.parse(mappingJson);
        mapping.name = name;
        saveMapping(cwd, mapping);
        console.log(`${pc.green("Added")} sync mapping: ${pc.bold(name)}`);
        console.log(`  Platform: ${mapping.platform}`);
        console.log(`  Record type: ${mapping.record.type}`);
        console.log(
          `  Pagination: ${mapping.pagination.type}`
        );
        console.log(
          `\nRun: ${pc.cyan(`pipesync pull ${name}`)} to start syncing`
        );
      } catch (err) {
        console.error("Invalid JSON:", (err as Error).message);
        process.exit(1);
      }
    }
  );

// =============================================================================
// List
// =============================================================================

program
  .command("list")
  .description("List configured sync mappings")
  .action(() => {
    const names = listMappings(cwd);
    if (names.length === 0) {
      console.log("No sync mappings configured.");
      console.log(`Run: ${pc.cyan("pipesync add <name> --config '<json>'")} `);
      return;
    }

    console.log(`${pc.bold("Sync Mappings:")}\n`);
    for (const name of names) {
      const mapping = loadMapping(cwd, name);
      const state = loadState(cwd, name);
      if (!mapping) continue;

      const statusIcon =
        state.status === "completed"
          ? pc.green("OK")
          : state.status === "error"
            ? pc.red("ERR")
            : state.status === "running"
              ? pc.yellow("RUN")
              : pc.dim("--");

      console.log(
        `  ${statusIcon} ${pc.bold(name)} (${mapping.platform}) -> ${mapping.record.type}`
      );
      if (state.lastSyncAt) {
        console.log(
          `     Last sync: ${state.lastSyncAt} | Total: ${state.totalSynced} records`
        );
      }
    }
    console.log(`\n${names.length} mappings`);
  });

// =============================================================================
// Show
// =============================================================================

program
  .command("show <name>")
  .description("Show details of a sync mapping")
  .action((name: string) => {
    const mapping = loadMapping(cwd, name);
    if (!mapping) {
      console.error(`Mapping not found: ${name}`);
      process.exit(1);
    }

    const state = loadState(cwd, name);

    console.log(`${pc.bold(name)}\n`);
    console.log(`Platform:    ${mapping.platform}`);
    console.log(`Connection:  ${mapping.connectionKey}`);
    console.log(`Action:      ${mapping.actionId}`);
    console.log(`Record type: ${mapping.record.type}`);
    console.log(`Pagination:  ${mapping.pagination.type}`);
    console.log(`External:    ${mapping.externalRef.system}`);

    if (mapping.incremental) {
      console.log(`Incremental: ${mapping.incremental.type}`);
    }

    console.log(`\n${pc.bold("State:")}`);
    console.log(`  Status:     ${state.status}`);
    console.log(`  Last sync:  ${state.lastSyncAt || "never"}`);
    console.log(`  Total:      ${state.totalSynced} records`);
    console.log(`  Last run:   ${state.lastRunRecords} records`);
    if (state.lastError) {
      console.log(`  Error:      ${pc.red(state.lastError)}`);
    }

    console.log(`\n${pc.bold("Mapping:")}`);
    for (const [target, source] of Object.entries(mapping.record.mapping)) {
      console.log(`  ${target} <- ${source}`);
    }
  });

// =============================================================================
// Pull
// =============================================================================

program
  .command("pull [name]")
  .description("Run sync (pull data)")
  .option("--full", "Full resync (ignore incremental state)")
  .option("-o, --output <type>", "Output destination: stdout, mem (default: stdout)", "stdout")
  .option("-v, --verbose", "Verbose output")
  .action(async (name: string | undefined, options: { full?: boolean; output: string; verbose?: boolean }) => {
    const config = loadConfig(cwd);
    const secretKey =
      config.picaSecretKey ||
      process.env.PICA_SECRET_KEY ||
      process.env.PICA_SECRET;

    if (!secretKey) {
      console.error(
        "No Pica secret key. Set PICA_SECRET_KEY or run pipesync init --pica-key <key>"
      );
      process.exit(1);
    }

    const output = await createOutput(options.output);

    const names = name ? [name] : listMappings(cwd);
    if (names.length === 0) {
      console.log("No sync mappings to pull.");
      return;
    }

    for (const n of names) {
      const mapping = loadMapping(cwd, n);
      if (!mapping) {
        console.error(`Mapping not found: ${n}`);
        continue;
      }

      console.log(`\n${pc.bold(`Pulling: ${n}`)} (${mapping.platform})`);

      const result = await pull(mapping, {
        baseDir: cwd,
        secretKey,
        picaBaseUrl: config.picaBaseUrl,
        output,
        full: options.full,
        verbose: options.verbose,
      });

      if (result.status === "completed") {
        console.log(
          `  ${pc.green("Done:")} ${result.new} new, ${result.updated} updated, ${result.errors} errors (${result.duration})`
        );
      } else {
        console.log(
          `  ${pc.red("Error:")} ${result.error}`
        );
        console.log(
          `  Partial: ${result.new} new, ${result.updated} updated, ${result.errors} errors (${result.duration})`
        );
      }
    }
  });

// =============================================================================
// Status
// =============================================================================

program
  .command("status")
  .description("Show sync status for all mappings")
  .action(() => {
    const names = listMappings(cwd);
    if (names.length === 0) {
      console.log("No sync mappings configured.");
      return;
    }

    console.log(`${pc.bold("Sync Status:")}\n`);
    for (const name of names) {
      const state = loadState(cwd, name);
      const mapping = loadMapping(cwd, name);
      if (!mapping) continue;

      const statusColor =
        state.status === "completed"
          ? pc.green
          : state.status === "error"
            ? pc.red
            : state.status === "running"
              ? pc.yellow
              : pc.dim;

      console.log(`${pc.bold(name)}`);
      console.log(`  Status:    ${statusColor(state.status)}`);
      console.log(`  Last sync: ${state.lastSyncAt || "never"}`);
      console.log(`  Total:     ${state.totalSynced} records`);
      console.log(`  Last run:  ${state.lastRunRecords} records`);
      if (state.lastError) {
        console.log(`  Error:     ${pc.red(state.lastError)}`);
      }
      console.log();
    }
  });

// =============================================================================
// Watch
// =============================================================================

program
  .command("watch")
  .description("Continuously sync at an interval")
  .option("--interval <duration>", "Sync interval (e.g. 30m, 1h, 5m)", "30m")
  .option("-o, --output <type>", "Output destination: stdout, mem (default: stdout)", "stdout")
  .option("-v, --verbose", "Verbose output")
  .action(async (options: { interval: string; output: string; verbose?: boolean }) => {
    const intervalMs = parseDuration(options.interval);
    if (!intervalMs) {
      console.error(
        "Invalid interval. Use format: 5m, 30m, 1h, etc."
      );
      process.exit(1);
    }

    console.log(
      `${pc.bold("Watching")} - syncing every ${options.interval}\n`
    );

    const runSync = async () => {
      const config = loadConfig(cwd);
      const secretKey =
        config.picaSecretKey ||
        process.env.PICA_SECRET_KEY ||
        process.env.PICA_SECRET;

      if (!secretKey) {
        console.error("No Pica secret key configured.");
        return;
      }

      const output = await createOutput(options.output);
      const names = listMappings(cwd);

      for (const name of names) {
        const mapping = loadMapping(cwd, name);
        if (!mapping) continue;

        const result = await pull(mapping, {
          baseDir: cwd,
          secretKey,
          picaBaseUrl: config.picaBaseUrl,
          output,
          verbose: options.verbose,
        });

        const timestamp = new Date().toLocaleTimeString();
        if (result.new > 0 || result.updated > 0 || result.errors > 0) {
          console.log(
            `[${timestamp}] ${name}: ${result.new} new, ${result.updated} updated, ${result.errors} errors`
          );
        }
      }
    };

    // Initial run
    await runSync();

    // Scheduled runs
    setInterval(runSync, intervalMs);
  });

// =============================================================================
// Remove
// =============================================================================

program
  .command("remove <name>")
  .description("Remove a sync mapping")
  .action((name: string) => {
    if (removeMapping(cwd, name)) {
      console.log(`${pc.green("Removed:")} ${name}`);
    } else {
      console.error(`Mapping not found: ${name}`);
      process.exit(1);
    }
  });

// =============================================================================
// Update
// =============================================================================

program
  .command("update <name>")
  .description("Update a sync mapping config")
  .option("-c, --config <json>", "Updated mapping config as JSON")
  .option("-f, --config-file <path>", "Updated mapping config from file")
  .action(
    (name: string, options: { config?: string; configFile?: string }) => {
      const existing = loadMapping(cwd, name);
      if (!existing) {
        console.error(`Mapping not found: ${name}`);
        process.exit(1);
      }

      let mappingJson: string;
      if (options.configFile) {
        mappingJson = readFileSync(options.configFile, "utf8");
      } else if (options.config) {
        mappingJson = options.config;
      } else {
        console.error("Provide --config or --config-file");
        process.exit(1);
      }

      try {
        const mapping: SyncMapping = JSON.parse(mappingJson);
        mapping.name = name;
        saveMapping(cwd, mapping);
        console.log(`${pc.green("Updated")} sync mapping: ${pc.bold(name)}`);
      } catch (err) {
        console.error("Invalid JSON:", (err as Error).message);
        process.exit(1);
      }
    }
  );

// =============================================================================
// Helpers
// =============================================================================

function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

// =============================================================================
// Run
// =============================================================================

program.parse();
