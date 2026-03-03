---
'mastracode': minor
---

Added plan persistence: approved plans are now saved as markdown files to disk. Plans are stored at the platform-specific app data directory (e.g. ~/Library/Application Support/mastracode/plans/ on macOS). Set the MASTRA_PLANS_DIR environment variable to override the storage location.
