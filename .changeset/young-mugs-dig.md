---
'@mastra/core': patch
---

Fixed agents with `autoResumeSuspendedTools` enabled failing on providers that enforce strict tool schemas (for example OpenAI). The injected `resumeData` field is now a valid, typed schema — derived from the tool's own `resumeSchema` when it declares one — and the resume fields are only added to tools that can actually suspend, instead of every tool the agent has.
