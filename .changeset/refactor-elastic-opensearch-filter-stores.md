---
"@mastra/elasticsearch": patch
"@mastra/opensearch": patch
---

Internal refactor only — no behavioral or API changes. Both stores now share a common filter translation base from `@mastra/core`, so future filter bug fixes will apply to both engines simultaneously. Fixes #13115.
