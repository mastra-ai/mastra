---
'@mastra/deployer': patch
---

Fixed `mastra build` on Windows adding spurious npm dependencies (like `apps`) from monorepo directory names.

Rollup inter-chunk file references (e.g., `apps/@agents/devstudio/.mastra/.build/chunk-X.mjs`) were being mistaken for npm package imports because they don't start with `./` or `/`. Now skips imports ending with file extensions (`.mjs`, `.js`, `.cjs`, etc.) since these are always file paths, not npm package specifiers.

Fixes https://github.com/mastra-ai/mastra/issues/13022
