# Getting Started with pipesync

## Prerequisites

- Node.js 18+
- A [Pica](https://picaos.com) account with at least one connected platform

## Install

```bash
npm install pipesync
```

To store synced data in a searchable database, also install [@withone/mem](https://github.com/nicholasgriffintn/mem):

```bash
npm install pipesync @withone/mem
```

Or pipe output to stdout (NDJSON) and send it anywhere.

## Setup

### 1. Initialize pipesync

```bash
npx pipesync init --pica-key <your-pica-secret-key>
```

This creates a `.pipesync/` directory in your project for storing mapping configs and sync state.

### 2. Add a sync mapping

The mapping config tells pipesync how to pull data from a platform and store it. In an AI coding tool (Claude Code, Cursor, etc.), the AI generates this for you using Pica MCP. You can also write it manually:

```bash
npx pipesync add my-contacts --config '{
  "name": "my-contacts",
  "platform": "attio",
  "connectionKey": "live::attio::default::abc123",
  "actionId": "conn_mod_def::xyz::list-records",
  "request": {
    "method": "POST",
    "path": "/v2/objects/people/records/query",
    "body": { "limit": 100 }
  },
  "pagination": {
    "type": "offset",
    "requestParam": "offset",
    "itemsField": "data",
    "pageSize": 100
  },
  "record": {
    "type": "contact",
    "mapping": {
      "name": "values.name.0.full_name",
      "email": "values.email_addresses.0.email_address"
    },
    "tags": ["attio", "contact"]
  },
  "externalRef": {
    "system": "attio",
    "idField": "id.record_id"
  }
}'
```

### 3. Pull data

```bash
# To stdout (NDJSON, default)
npx pipesync pull my-contacts

# To @withone/mem database
npx pipesync pull my-contacts --output mem

# Pipe to jq, a file, or another process
npx pipesync pull my-contacts | jq '.data.name'
npx pipesync pull my-contacts > contacts.jsonl
```

Output:
```
Pulling: my-contacts (attio)
  Done: 89 new, 0 updated, 0 errors (3.2s)
```

### 4. Search your data (with mem)

```bash
npx mem search "john" -t contact
```

## How it works

1. **You describe what to sync** via a JSON mapping config
2. **pipesync calls the Pica API** to fetch data from the connected platform
3. **Field mapping** extracts the fields you care about using dot-path notation
4. **Deduplication** uses keys or external references to avoid importing duplicates
5. **Records are output** to stdout (NDJSON) or stored in @withone/mem

The sync engine is deterministic. No AI runs at sync time. The AI's job is to generate the mapping config (using Pica MCP to understand the API), and the engine handles the rest.

## AI-Assisted Setup

The best way to use pipesync is with an AI coding tool that has Pica MCP connected:

```
User: "I want to sync my Gmail emails into my database"

AI:
  1. Uses Pica MCP to discover Gmail actions
  2. Reads the API response shape
  3. Generates a mapping config
  4. Runs: pipesync add gmail-emails --config '...'
  5. Runs: pipesync pull gmail-emails --output mem
  6. Reports: "Synced 1,247 emails"
```

Install the Claude Code skills for a streamlined experience:

```bash
cp -r node_modules/pipesync/skills/* .claude/skills/
```

Then use `/sync-setup` to configure new syncs and `/sync-pull` to refresh data.

## Next steps

- [CLI Reference](./cli-reference.md) - All available commands
- [Mapping Format](./mapping-format.md) - Detailed mapping config documentation
