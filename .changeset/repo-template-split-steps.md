---
'@mastra/platform-workspace': minor
---

createRepoTemplate now emits one build step per command (clone, fetch+checkout, and each setup command) instead of one combined step, so a failed template build reports the exact command that failed and completed steps stay layer-cached across attempts. setupCommand also accepts an array to run each entry as its own step, e.g. `['pnpm i', 'pnpm build']`.
