---
'@mastra/client-js': patch
---

The client-js package had its own simpler zodToJsonSchema implementation that was missing critical features from schema-compat. This could cause issues when users pass Zod schemas with `z.record()` or `z.date()` through the MastraClient.

Now the client uses the same implementation as the rest of the codebase, which includes the Zod v4 `z.record()` bug fix, date-time format conversion for `z.date()`, and proper handling of unrepresentable types.

Also removes the now-unused `zod-to-json-schema` dependency from client-js.
