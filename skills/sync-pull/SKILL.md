# /sync-pull

Pull/refresh synced data from external platforms.

## Triggers

"pull data", "refresh sync", "sync pull", "update my data", "re-sync"

## Workflow

1. **Check status:**
   ```bash
   npx pipesync status
   ```

2. **Show the user current state:**
   - Which syncs are configured
   - Last sync time for each
   - Total records synced
   - Any errors

3. **Run the pull:**
   ```bash
   # Pull a specific sync
   npx pipesync pull <name>

   # Pull all syncs
   npx pipesync pull

   # Force full resync (ignore incremental)
   npx pipesync pull <name> --full
   ```

4. **Report results:**
   - New records added
   - Records skipped (already exist)
   - Any errors
   - Duration

5. **Verify if needed:**
   ```bash
   npx mem search "<query>" -t <type>
   ```

## Options

- `--full`: Ignore incremental state, pull everything from scratch
- `-v, --verbose`: Show detailed progress during pull
- `-o, --output <type>`: Output destination (stdout, mem). Default: stdout
- No name argument: pulls all configured syncs

## Watch Mode

For continuous syncing:
```bash
npx pipesync watch --interval 30m
```
