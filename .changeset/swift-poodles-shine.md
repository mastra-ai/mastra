---
'@mastra/playground-ui': patch
---

Agent Builder starter agents now use the admin-configured default model when the model policy has one set. Previously, the starter ignored the admin default and always picked the first entry from the picker allowlist, which surfaced as "default model gets over-written by agent builder" on agents created from starter cards or the freeform prompt.

When no admin default is set, behavior is unchanged: the starter falls back to the first allowed model, then to the hardcoded fallback.
