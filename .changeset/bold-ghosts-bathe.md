---
'mastra': minor
---

Added `mastra migrate` CLI command to manually run storage migrations. This command bundles and executes the migration script against your configured storage backend, deduplicating spans and adding unique constraints. Useful when upgrading from older versions that may have duplicate (traceId, spanId) entries.

**Usage:**

```bash
npx mastra migrate
```

**Options:**

- `-d, --dir <path>` - Path to your Mastra folder (default: `src/mastra`)
- `-r, --root <path>` - Path to your root folder
- `-e, --env <env>` - Custom env file to include
- `--debug` - Enable debug logs
