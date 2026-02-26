/**
 * @withone/mem output adapter
 *
 * Stores synced records in mem (Supabase-backed memory system).
 * Requires @withone/mem to be installed: npm install @withone/mem
 */

import type { SyncOutput } from "./interface.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MemModule = any;

export class MemOutput implements SyncOutput {
  private mem: MemModule = null;

  private async getMem(): Promise<MemModule> {
    if (!this.mem) {
      try {
        this.mem = await import("@withone/mem");
      } catch {
        throw new Error(
          "@withone/mem is not installed. Run: npm install @withone/mem"
        );
      }
    }
    return this.mem;
  }

  async upsert(record: {
    type: string;
    data: Record<string, unknown>;
    tags?: string[];
    keys?: string[];
  }): Promise<{ id: string; action: "inserted" | "updated" }> {
    const mem = await this.getMem();

    // If keys provided and upsertByKeys exists, use key-based upsert for dedup
    if (record.keys?.length && typeof mem.upsertByKeys === "function") {
      const result = await mem.upsertByKeys(record.type, record.data, record.keys, {
        tags: record.tags,
      });

      if (!result) {
        throw new Error(`Failed to upsert record of type ${record.type}`);
      }

      return { id: result.record.id, action: result.action };
    }

    // Fall back to plain add
    const result = await mem.add(record.type, record.data, {
      tags: record.tags,
      generateEmbedding: true,
    });

    if (!result) {
      throw new Error(`Failed to upsert record of type ${record.type}`);
    }

    return { id: result.id, action: "inserted" };
  }

  async findByRef(system: string, externalId: string): Promise<string | null> {
    const mem = await this.getMem();
    const result = await mem.findByExternalRef(system, externalId);
    return result?.record?.id ?? null;
  }

  async addRef(
    recordId: string,
    ref: { system: string; externalId: string; url?: string }
  ): Promise<void> {
    const mem = await this.getMem();
    await mem.addExternalRef(recordId, ref.system, ref.externalId, {
      url: ref.url,
    });
  }
}
