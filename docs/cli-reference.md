# CLI Reference

## pipesync init

Initialize pipesync in the current directory.

```bash
pipesync init [--pica-key <key>]
```

Creates `.pipesync/` directory with config, mappings, and state subdirectories.

**Options:**
- `--pica-key <key>` - Pica secret key. Also reads from `PICA_SECRET_KEY` env var.

## pipesync add

Add a new sync mapping.

```bash
pipesync add <name> --config '<json>'
pipesync add <name> --config-file <path>
```

**Arguments:**
- `name` - Unique identifier for this sync (e.g., `gmail-emails`, `attio-contacts`)

**Options:**
- `-c, --config <json>` - Mapping config as a JSON string
- `-f, --config-file <path>` - Path to a JSON file containing the mapping config

## pipesync list

List all configured sync mappings with their status.

```bash
pipesync list
```

## pipesync show

Show detailed info about a specific sync mapping.

```bash
pipesync show <name>
```

Displays: platform, connection, action, record type, pagination, field mappings, and current sync state.

## pipesync pull

Run the sync loop to pull data.

```bash
pipesync pull [name]              # Pull specific or all mappings
pipesync pull --full              # Ignore incremental state, full resync
pipesync pull -o mem              # Output to @withone/mem
pipesync pull | jq '.data'        # Pipe NDJSON to jq
pipesync pull -v                  # Verbose output
```

**Arguments:**
- `name` - (Optional) Specific mapping to pull. Omit to pull all.

**Options:**
- `--full` - Full resync, ignoring incremental filters
- `-o, --output <type>` - Output destination: `stdout` (default), `mem`
- `-v, --verbose` - Show per-page progress

**Output:** Reports new records, updated, errors, and duration.

## pipesync status

Show sync status for all mappings.

```bash
pipesync status
```

Displays: status (idle/running/completed/error), last sync time, total records, and errors.

## pipesync watch

Continuously sync at a given interval.

```bash
pipesync watch [--interval 30m]
```

**Options:**
- `--interval <duration>` - Sync interval. Supports: `5s`, `30m`, `1h`, `1d`. Default: `30m`.
- `-o, --output <type>` - Output destination: `stdout` (default), `mem`
- `-v, --verbose` - Verbose output

## pipesync remove

Remove a sync mapping and its state.

```bash
pipesync remove <name>
```

## pipesync update

Update an existing mapping config.

```bash
pipesync update <name> --config '<json>'
pipesync update <name> --config-file <path>
```

Replaces the mapping config while preserving sync state.
