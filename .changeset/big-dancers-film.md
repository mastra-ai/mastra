---
'@mastra/playground-ui': patch
'@mastra/factory': patch
---

Speed up the local dev watch for the design system: `pnpm dev:ui` now rebuilds `@mastra/playground-ui` on save, so design-system edits show up in the Factory UI without a manual rebuild. `pnpm dev:playground` picks up the same watch. Skipping type declaration emit in watch mode brings each rebuild from ~9s down to ~1.5s.

Declarations stay frozen at the last full build for the length of a dev session — run `pnpm --filter @mastra/playground-ui build` after changing a component's props. The published build is unchanged and still emits declarations.
