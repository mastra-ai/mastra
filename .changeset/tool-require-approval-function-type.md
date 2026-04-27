---
'@mastra/core': patch
---

Fixed the TypeScript type for `requireApproval` on tools so it accepts a function in addition to a boolean. The runtime already supported per-call approval functions (added in #15346), but the type still required `boolean`, forcing an `as any` cast. You can now pass a sync or async predicate without a cast — the predicate receives the validated tool input and an optional `{ requestContext, workspace }` second argument. Fixes #15647.
