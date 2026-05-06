---
'@internal/playground': patch
---

Fixed local studio CSS to import design tokens directly from `@mastra/playground-ui` source. Removes ~80 lines of divergent token redeclarations (hex/rgba) that were silently overridden by the auto-injected oklch tokens from playground-ui. Single source of truth, no behavior change.
