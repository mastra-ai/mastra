# @mastra/spanner

## 1.0.0

### Major Changes

- Initial stable release of the Google Cloud Spanner storage adapter for Mastra. Supports the GoogleSQL dialect with full storage-domain parity: `memory`, `workflows`, `scores`, `backgroundTasks`, `agents`, `mcpClients`, `mcpServers`, `skills`, `blobs`, `promptBlocks`, `scorerDefinitions`, `schedules` (cron-driven workflow triggers consumed by `WorkflowScheduler`), and `observability` (AI tracing spans persisted in `mastra_ai_spans` with the full trace read/write surface). Works against managed Spanner instances and the local Spanner emulator.
