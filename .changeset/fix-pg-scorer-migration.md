---
"@mastra/pg": patch
---

fix(pg): add missing alterTable for scorers backwards compatibility

Add `alterTable` call in `ScoresPG.init()` to ensure `spanId` and `requestContext` columns exist for backwards compatibility during v0.x to v1 migration. This aligns PostgreSQL implementation with LibSQL which already has this migration logic.
