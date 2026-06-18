---
"@mastra/core": minor
---

Move the Harness's live token-usage counter onto the `Session` class. The `Session` now owns the in-memory running tally (`getTokenUsage`, `setTokenUsage`, `resetTokenUsage`, `addUsage`), while the Harness continues to persist usage to (and hydrate it from) thread metadata, since token usage is thread-scoped.

The `harness.getTokenUsage()` method is removed in favor of the `harness.session` accessor:

- `harness.getTokenUsage()` → `harness.session.getTokenUsage()`
