---
'mastracode': minor
---

Added Mastra Gateway integration for model routing and memory.

- Added `/memory-gateway` TUI command for configuring gateway connection settings
- Gateway-backed agents skip local observational memory (managed remotely by the gateway server)
- Model routing now supports gateway providers with automatic sync on startup and after configuration changes
- Provider availability checks handle gateway provider naming patterns
