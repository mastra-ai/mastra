---
'@mastra/pg': patch
---

Fixed agent listings crashing with HTTP 500 when any row in `mastra_agent_versions` has a jsonb column stored as a scalar string (e.g. `model = "google/gemini-3-flash"`). One bad row no longer hides every other agent from the Editor.

**What changed**

- `parseJson` now returns the driver-deserialised value as-is when re-parsing a string fails, since for jsonb columns that string is already the materialised scalar.
- `list()` and `listVersions()` skip and warn on individual row mapping failures instead of failing fast.
- `createVersion` now rejects a string `model` input with a typed `INVALID_MODEL` error so bad data can't be written in the first place. Pass `{ slug: "<value>" }` instead.

**Why**

The `pg` driver auto-deserialises jsonb columns, so a jsonb scalar string arrives as a JS string. The previous `parseJson` then tried `JSON.parse("google/gemini-3-flash")`, which throws on the unquoted character. Combined with a fail-fast `.map` over every row, a single corrupt row took down the entire Mastra Editor agent listing in production.

Fixes #16224.
