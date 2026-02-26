/**
 * SyncOutput interface - the contract for any sync destination.
 *
 * Default implementation: @withone/mem (see mem.ts)
 * Future: SQLite, Postgres, JSON files, stdout, custom APIs
 */

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
