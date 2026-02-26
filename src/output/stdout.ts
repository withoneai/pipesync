/**
 * Stdout output adapter (NDJSON)
 *
 * Prints each synced record as a JSON line to stdout.
 * Pipe to jq, a file, another process, or anything.
 *
 * Usage:
 *   pipesync pull gmail-emails | jq '.data.subject'
 *   pipesync pull gmail-emails > emails.jsonl
 */

import type { SyncOutput } from "./interface.js";

let counter = 0;

export class StdoutOutput implements SyncOutput {
  private seen = new Map<string, string>();

  async upsert(record: {
    type: string;
    data: Record<string, unknown>;
    tags?: string[];
    keys?: string[];
  }): Promise<{ id: string; action: "inserted" | "updated" }> {
    // Generate a synthetic ID
    const id = `record-${++counter}`;

    // Check dedup via keys
    let action: "inserted" | "updated" = "inserted";
    if (record.keys) {
      for (const key of record.keys) {
        if (this.seen.has(key)) {
          action = "updated";
          break;
        }
      }
      for (const key of record.keys) {
        this.seen.set(key, id);
      }
    }

    // Print as NDJSON
    const line = JSON.stringify({
      id,
      type: record.type,
      data: record.data,
      tags: record.tags,
      keys: record.keys,
    });
    process.stdout.write(line + "\n");

    return { id, action };
  }

  async findByRef(system: string, externalId: string): Promise<string | null> {
    const key = `${system}:${externalId}`;
    return this.seen.get(key) ?? null;
  }

  async addRef(
    recordId: string,
    ref: { system: string; externalId: string; url?: string }
  ): Promise<void> {
    this.seen.set(`${ref.system}:${ref.externalId}`, recordId);
  }
}
