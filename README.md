# pipesync

Pull data from any API into any destination. Zero platform-specific code.

pipesync is a dynamic sync engine for [Pica](https://picaos.com)-connected platforms. You give it a JSON mapping config, it handles pagination, field mapping, deduplication, and incremental sync. The AI writes the config. The engine does the work.

## Install

```bash
npm install @withone/pipesync
```

## Quick Start

```bash
# Initialize
npx pipesync init --pica-key <your-key>

# Add a sync (AI generates this config via Pica MCP)
npx pipesync add gmail-emails --config '{
  "platform": "gmail",
  "connectionKey": "live::gmail::default::abc123",
  "actionId": "conn_mod_def::xyz::list-messages",
  "request": { "method": "GET", "path": "/users/me/messages", "queryParams": { "maxResults": 100 } },
  "pagination": { "type": "cursor", "requestParam": "pageToken", "responseField": "nextPageToken", "itemsField": "messages" },
  "record": { "type": "email", "mapping": { "subject": "payload.headers.Subject", "from": "payload.headers.From", "snippet": "snippet" }, "tags": ["gmail"] },
  "externalRef": { "system": "gmail", "idField": "id" }
}'

# Pull data (NDJSON to stdout by default)
npx pipesync pull gmail-emails

# Or pipe anywhere
npx pipesync pull gmail-emails | jq '.data.subject'
npx pipesync pull gmail-emails > emails.jsonl

# Or store in @withone/mem (optional)
npm install @withone/mem
npx pipesync pull gmail-emails --output mem
```

## How It Works

```
┌──────────────────────────┐
│     Your AI Tool         │
│  (Claude, Cursor, etc.)  │
│                          │
│  1. Pica MCP: learn API  │
│  2. Generate JSON config │
│  3. Run pipesync CLI     │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│        pipesync          │
│                          │
│  Pull → Map → Dedup →   │
│  Output (stdout or mem)  │
└──────┬───────────┬───────┘
       │           │
       ▼           ▼
  ┌─────────┐  ┌────────┐
  │Pica API │  │ stdout │
  │(200+ APIs)│ │ or mem │
  └─────────┘  └────────┘
```

1. **AI generates a mapping config** using Pica MCP to understand the platform's API shape
2. **pipesync pulls data** through Pica's passthrough API, handling pagination automatically
3. **Field mapping** extracts what you need using dot-path notation (`payload.headers.Subject`)
4. **Deduplication** via keys or external references prevents duplicates on re-sync
5. **Output** goes to stdout (NDJSON) by default, or [@withone/mem](https://github.com/withoneai/mem) for searchable storage

No AI runs at sync time. The engine is fully deterministic.

## CLI

```bash
pipesync init [--pica-key <key>]          # Initialize in current directory
pipesync add <name> --config '<json>'     # Add a sync mapping
pipesync pull [name] [--output mem]       # Pull data
pipesync pull --full                      # Full resync (ignore incremental)
pipesync status                           # Show sync status
pipesync list                             # List all mappings
pipesync show <name>                      # Show mapping details
pipesync watch [--interval 30m]           # Continuous sync
pipesync remove <name>                    # Remove a mapping
pipesync update <name> --config '<json>'  # Update a mapping
```

## Pagination

The AI picks the right strategy based on the platform's API:

| Type | How it works | Examples |
|------|-------------|----------|
| `cursor` | Token-based paging | Gmail, Notion, Slack |
| `offset` | Offset + limit | Attio, HubSpot |
| `sync-token` | Delta sync via token | Google Calendar |
| `link-header` | Parse Link header | GitHub |
| `page-number` | Increment page number | Many REST APIs |
| `none` | Single request | Small endpoints |

## Output Adapters

**stdout (default)** - NDJSON lines, pipe anywhere:
```bash
pipesync pull contacts | jq '.data.email'
pipesync pull contacts > contacts.jsonl
pipesync pull contacts | your-custom-script
```

**@withone/mem (optional)** - Searchable database with hybrid search:
```bash
npm install @withone/mem
pipesync pull contacts --output mem
npx mem search "john" -t contact
```

## AI-Assisted Setup

Works best with an AI coding tool that has [Pica MCP](https://picaos.com) connected:

```
User: "Sync my Gmail emails"

AI:
  1. Discovers Gmail actions via Pica MCP
  2. Reads API response shape
  3. Generates mapping config
  4. Runs: pipesync add gmail-emails --config '...'
  5. Runs: pipesync pull gmail-emails
  6. Done: "Synced 1,247 emails"
```

Claude Code skills are included for a streamlined experience:
```bash
cp -r node_modules/@withone/pipesync/skills/* .claude/skills/
```

Then use `/sync-setup` and `/sync-pull`.

## Docs

- [Getting Started](./docs/getting-started.md)
- [CLI Reference](./docs/cli-reference.md)
- [Mapping Format](./docs/mapping-format.md)

## License

MIT
