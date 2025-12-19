---
'@mastra/server': patch
---

Fixes issue #11185 where `MastraServer.tools` was rejecting tools created with `createTool({ inputSchema })`. Changed the tools property type from `Record<string, Tool>` to `ToolsInput` to accept tools with any schema types (input, output, or none), as well as Vercel AI SDK tools and provider-defined tools.

Tools created with `createTool({ inputSchema: z.object(...) })` now work without TypeScript errors.
