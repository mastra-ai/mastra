---
'@mastra/core': patch
---

Fix TypeScript type error where `AgentExecutionOptions<undefined>` (and the `Public` / `Inner` variants) incorrectly made `structuredOutput` a **required** field when `strictNullChecks` is disabled. Under `strictNullChecks: false`, `undefined extends {}` evaluates to `true`, causing the conditional type to demand `structuredOutput` for the `undefined` output case. The condition is now wrapped with a `[OUTPUT] extends [undefined]` guard that short-circuits to `{ structuredOutput?: never }` before the `extends {}` check, restoring correct behaviour in both strict and non-strict compilation modes.
