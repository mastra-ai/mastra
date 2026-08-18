---
'@mastra/playground-ui': patch
'@mastra/factory': patch
---

Speed up the local dev watch for the design system: `pnpm dev:ui` now rebuilds `@mastra/playground-ui` on save, so design-system edits show up in the Factory UI without a manual rebuild. `pnpm dev:playground` picks up the same watch. The watch starts from a full build and then skips type declaration emit on every rebuild, which brings each save from ~9s down to ~1.5s.

Declarations stay frozen at that starting build for the length of a dev session — run `pnpm --filter @mastra/playground-ui build` after changing a component's props. The published build is unchanged and still emits declarations.
