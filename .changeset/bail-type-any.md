---
"@mastra/core": patch
---

fix(workflows): add generic bail signature with overloads. The bail() function now uses method overloads - bail(result: TStepOutput) for backward compatibility and bail<T>(result: ...) for workflow type inference. This allows flexible early exits while maintaining type safety for workflow chaining. Runtime validation will be added in a follow-up.
