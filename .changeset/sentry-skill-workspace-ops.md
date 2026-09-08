---
'@mastra/sentry': patch
---

Skill and workspace spans now report as `ai.skill` and `ai.workspace` instead of the generic `ai.span`, matching how memory spans already map to `ai.memory`.

Span types that are missing from an older paired `@mastra/core` are skipped rather than mapped under an `undefined` key, which would otherwise match every span whose type is undefined.
