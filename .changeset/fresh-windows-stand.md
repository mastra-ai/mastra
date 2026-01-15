---
'@mastra/inngest': patch
'@mastra/core': patch
---

Improved TypeScript type inference for workflow steps.

**What changed:**
- Step input/output type mismatches are now caught at compile time when chaining steps with `.then()`
- The `execute` function now properly infers types from `inputSchema`, `outputSchema`, `stateSchema`, and other schema parameters
- Clearer error messages when step types don't match workflow requirements

**Why:**
Previously, type errors in workflow step chains would only surface at runtime. Now TypeScript validates that each step's input requirements are satisfied by the previous step's output, helping you catch integration issues earlier in development.
