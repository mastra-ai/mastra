---
'@mastra/core': minor
---

Added support for passing `requestContext` through the tool execution pipeline. The runtime `requestContext` is now correctly forwarded to tool calls and is preferred over the build-time context, following the same pattern as `workspace` and `tracingContext`.

Changes include:
- Added `requestContext` to the `MastraToolInvocationOptions` type
- Forwarded `requestContext` from workflow step execute params into `toolOptions` in `createToolCallStep`
- Updated `CoreToolBuilder` to prefer execution-time `requestContext` over build-time context
