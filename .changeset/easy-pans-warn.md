---
'@mastra/inngest': minor
---

Migrated to Inngest SDK v4. Updated `inngest` dependency from v3 to v4.2.2 and removed the separate `@inngest/realtime` package (now built into v4). Replaced Inngest API polling with snapshot-based polling for ~83x faster workflow result retrieval. Fixed Docker test connectivity and updated test infrastructure.
