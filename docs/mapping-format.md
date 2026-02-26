# Mapping Format

The mapping config is a JSON object that tells pipesync how to pull data from a platform and store it. The AI generates this by reading the platform's API docs via Pica MCP.

## Full Schema

```json
{
  "name": "gmail-emails",
  "platform": "gmail",
  "connectionKey": "live::gmail::default::abc123",
  "actionId": "conn_mod_def::GGSNOTZxFUU::list-messages",

  "request": {
    "method": "GET",
    "path": "/users/me/messages",
    "queryParams": { "maxResults": 100 },
    "body": {},
    "headers": {}
  },

  "pagination": {
    "type": "cursor",
    "requestParam": "pageToken",
    "responseField": "nextPageToken",
    "itemsField": "messages",
    "pageSize": 100
  },

  "detail": {
    "actionId": "conn_mod_def::GGSNOTZxFUU::get-message",
    "path": "/users/me/messages/{id}",
    "pathVar": "id",
    "idField": "id",
    "queryParams": { "format": "metadata" }
  },

  "record": {
    "type": "email",
    "mapping": {
      "subject": "payload.headers.Subject",
      "from": "payload.headers.From",
      "to": "payload.headers.To",
      "snippet": "snippet"
    },
    "tags": ["gmail"]
  },

  "externalRef": {
    "system": "gmail",
    "idField": "id",
    "urlTemplate": "https://mail.google.com/mail/#inbox/{id}"
  },

  "incremental": {
    "type": "query-filter",
    "param": "q",
    "template": "after:{lastSyncDate}"
  }
}
```

## Field Reference

### Top Level

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier for this sync |
| `platform` | Yes | Platform name (e.g., `gmail`, `attio`, `slack`) |
| `connectionKey` | Yes | Pica connection key (from integrations list) |
| `actionId` | Yes | Pica action ID for the list endpoint |

### request

How to call the API.

| Field | Default | Description |
|-------|---------|-------------|
| `method` | `GET` | HTTP method |
| `path` | `""` | API path (appended to Pica passthrough URL) |
| `queryParams` | `{}` | Static query parameters |
| `body` | - | Request body (for POST/PUT) |
| `headers` | `{}` | Additional headers |

### pagination

How to page through results.

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Pagination strategy (see table below) |
| `requestParam` | No | Query param name for cursor/offset/page |
| `responseField` | No | Response field containing next cursor/token |
| `itemsField` | No | Response field containing the items array |
| `pageSize` | No | Items per page (for offset/page-number) |

**Pagination Types:**

| Type | How it works | Example platforms |
|------|-------------|-------------------|
| `cursor` | Pass cursor from response to next request | Gmail, Notion, Slack |
| `offset` | Increment offset by page size | Attio, HubSpot |
| `sync-token` | Use sync token for incremental delta | Google Calendar |
| `link-header` | Parse `Link` header for next URL | GitHub |
| `page-number` | Increment page number | Many REST APIs |
| `none` | Single request, no pagination | Small endpoints |

### detail (optional)

If the list endpoint returns partial data, configure a detail endpoint to fetch full records.

| Field | Required | Description |
|-------|----------|-------------|
| `actionId` | Yes | Pica action ID for the detail endpoint |
| `path` | Yes | API path with `{var}` placeholder |
| `pathVar` | Yes | Name of the path variable |
| `idField` | Yes | Field in the list item containing the ID |
| `queryParams` | No | Additional query params for detail request |

### record

How to map API data to output records.

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Record type (e.g., `email`, `contact`) |
| `mapping` | Yes | Map of `targetField` -> `source.dot.path` |
| `tags` | No | Tags to add to each record |
| `keys` | No | Fields to use as dedup keys |

**Mapping uses dot-path notation:**
```
"subject": "payload.headers.Subject"  ->  item.payload.headers.Subject
"name": "values.name.0.full_name"     ->  item.values.name[0].full_name
"snippet": "snippet"                  ->  item.snippet
```

If a path doesn't resolve, the field is set to `null`. No errors.

### externalRef

How to track the source of each record (for dedup and linking).

| Field | Required | Description |
|-------|----------|-------------|
| `system` | Yes | Source system name (e.g., `gmail`) |
| `idField` | Yes | Dot-path to the unique ID in the item |
| `urlTemplate` | No | URL template with `{field}` placeholders for deep links |

### incremental (optional)

How to fetch only new data on subsequent syncs.

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Strategy: `query-filter`, `sync-token`, or `sort-filter` |
| `param` | No | Query param to set |
| `template` | No | Value template with `{lastSyncDate}` or `{syncToken}` |
| `tokenField` | No | Response field containing sync token |

**Incremental Types:**

- `query-filter`: Adds a date filter to the query (e.g., Gmail's `after:2026-02-01`)
- `sync-token`: Uses a sync token from the previous response (e.g., Google Calendar)
- `sort-filter`: Uses last sync date as a direct filter param

## File Storage

Mappings are stored in `.pipesync/mappings/<name>.json` and can be version-controlled. Sync state is stored in `.pipesync/state/<name>.json` and should typically be gitignored.

Recommended `.gitignore` addition:
```
.pipesync/state/
.pipesync/config.json
```
