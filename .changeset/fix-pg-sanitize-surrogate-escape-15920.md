---
"@mastra/pg": patch
---

Fixed workflow snapshot sanitization in `@mastra/pg` for strings containing escaped surrogate patterns like `[^\ud800-\udfff]`. This prevents invalid JSON escape sequences that caused PostgreSQL `jsonb` writes to fail with error `22P02`.

Fixes #15920
