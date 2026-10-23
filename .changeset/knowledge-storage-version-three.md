---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Knowledge storage now reports contract and schema version 3, so the version keeps increasing past the version 2 that `@mastra/core` 1.79.0 shipped. LibSQL and PostgreSQL databases created by pre-release snapshots with the same layout keep their rows and have their schema marker updated to 3.

Upgrade `@mastra/libsql` and `@mastra/pg` together with `@mastra/core`. Older adapter releases refuse to open Knowledge under this core with "@mastra/core advertises Knowledge v2 without the required storage API" and leave existing data untouched; other storage domains keep working.
