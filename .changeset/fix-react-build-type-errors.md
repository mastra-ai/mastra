---
'@mastra/react': patch
---

Fix TypeScript errors during build declaration generation

Updated test file `toUIMessage.test.ts` to match current `@mastra/core` types:
- Changed `error` property from string to `Error` object (per `StepFailure` type)
- Added missing `resumeSchema` property to `tool-call-approval` payloads (per `ToolCallApprovalPayload` type)
- Added `zod` as peer/dev dependency for test type support
