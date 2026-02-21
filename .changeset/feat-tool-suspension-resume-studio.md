---
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/react': minor
'@mastra/playground-ui': minor
---

Add tool suspension resume support in Studio.

Tools that call `suspend()` with a `suspendPayload` and `resumeSchema` now display a resume form in the Studio, allowing users to provide `resumeData` and continue execution. Previously, the suspension payload was displayed read-only with no way to resume.

**Server:** Added `/agents/:agentId/resume-tool-suspension` endpoint that calls `agent.resumeStream()` with user-provided resume data.

**Client JS:** Added `agent.resumeToolSuspension({ runId, toolCallId, resumeData })` method.

**React:** Added `resumeToolSuspension()` function and `toolSuspensionResumes` state to `useChat` hook.

**Playground UI:** Added `ToolSuspensionResume` component with JSON textarea, resume schema reference, and submit button. Passes `resumeSchema` through stream metadata so the UI knows the expected data shape.

Fixes #13197
