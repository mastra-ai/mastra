---
'@mastra/core': patch
'mastra': patch
---

Fixed migration CLI failing with MIGRATION_REQUIRED error during Mastra import. Added MASTRA_DISABLE_STORAGE_INIT environment variable to skip auto-initialization of storage, allowing the migration command to import user's Mastra config without triggering the migration check. Also improved the migration prompt display to show warning messages before the confirmation dialog.
