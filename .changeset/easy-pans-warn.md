---
'@mastra/inngest': minor
---

Updated `@mastra/inngest` to use Inngest SDK v4.

**Breaking:** The `@inngest/realtime` package is no longer needed — its functionality is now included in `inngest` v4. Remove it from your dependencies and import realtime helpers from `inngest/realtime` instead.

**Improved:** Workflow result polling now uses snapshot-based polling, resulting in significantly faster retrieval (~83x).
