---
'@mastra/client-js': patch
---

Fixed client-side tools with execute functions having their Zod inputSchema sent to the LLM unconverted, causing OpenAI to reject requests with "Invalid schema for function" errors.

The root cause was in processClientTools: isVercelTool() returns true for any tool with execute + inputSchema, causing the code to only serialize parameters (which ClientTool doesn't have), leaving inputSchema as a raw Zod object. When JSON-serialized over the network, a Zod schema becomes { type: "object", def: {...} } — not valid JSON Schema.

The fix removes the isVercelTool branching and instead always serializes whichever schema fields are present (parameters, inputSchema, outputSchema). Since zodToJsonSchema passes non-Zod values through unchanged, this is safe to call unconditionally.

Fixes #11668. Alternative to #11787.
