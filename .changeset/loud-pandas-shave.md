---
'mastra': patch
---

Studio no longer requires `'unsafe-eval'` in its Content Security Policy.

Studio built its dynamic forms (tool inputs, workflow trigger/resume/state schemas, request context schemas) by generating Zod source code from a JSON Schema and compiling it with `Function()`. That forced every self-hosted deployment to relax its CSP with `'unsafe-eval'` just to render a form.

Those schemas are now constructed by calling the Zod API directly, so no string is ever compiled and Studio runs under a CSP without `'unsafe-eval'`.
