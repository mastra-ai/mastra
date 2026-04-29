---
"@mastra/pg": patch
---

fix(pg): handle escaped-backslash surrogate sequences in sanitizeJsonForPg

When a workflow step output contained strings like JavaScript regex literals
(e.g. `[^\ud800-\udfff]`), the previous `sanitizeJsonForPg` function would
remove the `\uXXXX` surrogate escapes but leave behind a dangling backslash,
producing an invalid JSON escape sequence (`\-`) that caused PostgreSQL to
throw `invalid input syntax for type json` (error code 22P02).

The fix changes the surrogate-removal regex from `/\\u.../` to `/\\\\?u.../`
so that the optional preceding escaped backslash (`\\u`) is also consumed.
The invalid-escape-sequence fix pass now runs **after** surrogate removal
to catch any characters newly exposed by the deletion.

Fixes #15920
