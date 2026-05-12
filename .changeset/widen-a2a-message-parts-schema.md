---
'@mastra/server': patch
---

Widened the A2A handler-level `messageSendParamsSchema` to accept the full `text | file | data` Part discriminated union per the @a2a-js/sdk Part type. Previously the schema hard-coded `kind: z.enum(['text'])`, which rejected file and data parts before the existing `convertToCoreMessage` converter (which already handles all three) could see them. `FilePart` with `FileWithBytes` or `FileWithUri` now converts to an AI-SDK `CoreMessage` file part natively. The schema is still strict on the kind discriminator — unknown kinds continue to return the standard JSON-RPC `-32602` invalid-params.
