---
'@mastra/core': patch
---

Fixed Harness `stateSchema` typing to accept Zod schemas with `.default()`, `.optional()`, and `.transform()` modifiers. Previously, these modifiers caused TypeScript errors because the type system forced schema Input and Output types to be identical. Now `stateSchema` correctly accepts any schema regardless of input type divergence.
