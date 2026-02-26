# /sync-setup

Set up a new data sync from an external platform into mem.

## Triggers

"sync my data", "set up sync", "pull data from", "connect [platform] to my database", "sync my emails/contacts/messages"

## Workflow

1. **Check prerequisites:**
   ```bash
   # Verify mem is installed and initialized
   npx mem context 2>/dev/null || (npm install @withone/mem && npx mem init)

   # Verify pipesync is installed
   npx pipesync status 2>/dev/null || npm install pipesync

   # Initialize pipesync if needed
   npx pipesync init --pica-key $PICA_SECRET_KEY
   ```

2. **Discover available platforms:**
   - Use Pica MCP: `list_pica_integrations` to see connected platforms
   - Ask user which platform/data they want to sync

3. **Understand the API:**
   - Use Pica MCP: `search_pica_platform_actions` with the platform name
   - Use Pica MCP: `get_pica_action_knowledge` for the list/get actions
   - Pay attention to:
     - Response shape (where items are, what fields exist)
     - Pagination pattern (cursor, offset, page-number, etc.)
     - Available query params for filtering
     - Detail endpoints for full record data

4. **Generate mapping config:**

   Build a JSON mapping config based on the API knowledge:

   ```json
   {
     "name": "<descriptive-name>",
     "platform": "<platform>",
     "connectionKey": "<from integrations list>",
     "actionId": "<from action search>",
     "request": {
       "method": "GET",
       "path": "<API path>",
       "queryParams": { "<relevant params>" }
     },
     "pagination": {
       "type": "cursor|offset|sync-token|link-header|page-number|none",
       "requestParam": "<param name for cursor/offset/page>",
       "responseField": "<field with next cursor>",
       "itemsField": "<field containing the items array>",
       "pageSize": 100
     },
     "detail": {
       "actionId": "<detail action ID if needed>",
       "path": "<detail path with {id}>",
       "pathVar": "id",
       "idField": "id",
       "queryParams": {}
     },
     "record": {
       "type": "<mem record type>",
       "mapping": {
         "<target_field>": "<source.dot.path>"
       },
       "tags": ["<platform>"]
     },
     "externalRef": {
       "system": "<platform>",
       "idField": "id",
       "urlTemplate": "<deep link URL with {id}>"
     },
     "incremental": {
       "type": "query-filter",
       "param": "<query param>",
       "template": "<filter template with {lastSyncDate}>"
     }
   }
   ```

5. **Add and run the sync:**
   ```bash
   npx pipesync add <name> --config '<json>'
   npx pipesync pull <name>
   ```

6. **Verify results:**
   ```bash
   npx mem search "<relevant query>" -t <record_type>
   npx pipesync status
   ```

7. **Report to user:**
   - How many records were synced
   - Any errors encountered
   - How to pull again: `npx pipesync pull <name>`
   - How to search: `npx mem search "<query>"`

## Mapping Tips

- **Gmail emails:** Use `format=metadata` with `metadataHeaders` to flatten headers
- **Offset pagination:** Set `pageSize` to match the API's limit parameter
- **Cursor pagination:** Find the `nextPageToken` or `cursor` field in docs
- **Detail endpoint:** Only use if the list endpoint doesn't return enough data
- **Incremental:** Use `query-filter` with date-based params when available
- **External URLs:** Build deep links so users can click through to the source

## Examples

### Gmail Emails
```bash
npx pipesync add gmail-emails --config '{
  "name": "gmail-emails",
  "platform": "gmail",
  "connectionKey": "<key>",
  "actionId": "<action>",
  "request": { "method": "GET", "path": "/users/me/messages", "queryParams": { "maxResults": 100 } },
  "pagination": { "type": "cursor", "requestParam": "pageToken", "responseField": "nextPageToken", "itemsField": "messages" },
  "detail": { "actionId": "<detail-action>", "path": "/users/me/messages/{id}", "pathVar": "id", "idField": "id", "queryParams": { "format": "metadata", "metadataHeaders": "Subject,From,To,Date" } },
  "record": { "type": "email", "mapping": { "subject": "payload.headers.Subject", "from": "payload.headers.From", "to": "payload.headers.To", "date": "payload.headers.Date", "snippet": "snippet", "thread_id": "threadId", "labels": "labelIds" }, "tags": ["gmail"] },
  "externalRef": { "system": "gmail", "idField": "id", "urlTemplate": "https://mail.google.com/mail/#inbox/{id}" },
  "incremental": { "type": "query-filter", "param": "q", "template": "after:{lastSyncDate}" }
}'
```

### Attio Contacts
```bash
npx pipesync add attio-contacts --config '{
  "name": "attio-contacts",
  "platform": "attio",
  "connectionKey": "<key>",
  "actionId": "<action>",
  "request": { "method": "POST", "path": "/v2/objects/people/records/query", "body": { "limit": 100 } },
  "pagination": { "type": "offset", "requestParam": "offset", "itemsField": "data", "pageSize": 100 },
  "record": { "type": "contact", "mapping": { "name": "values.name.0.full_name", "email": "values.email_addresses.0.email_address", "company": "values.company.0.value" }, "tags": ["attio"] },
  "externalRef": { "system": "attio", "idField": "id.record_id", "urlTemplate": "https://app.attio.com/people/{id.record_id}" }
}'
```
