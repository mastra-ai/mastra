---
'@mastra/slack': patch
'@mastra/core': patch
---

Bumped `chat` to ^4.29.0 (was ^4.24.0). Channel adapters built against newer `chat` releases (e.g. `@chat-adapter/discord`) silently failed at runtime because of incompatible `Adapter` types across versions; aligning on 4.29.0 fixes the silent dispatch failure for Discord and other newer adapters.
