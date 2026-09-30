---
'@mastra/core': patch
---

Fixed `ToolCallFilter` stripping a resumed run's own tool calls. When a tool suspended the agent (for example `askUserTool`) and the run was continued with `resumeStream()`, the filter treated the suspended tool call and its result as prior history and removed them from the model prompt. The model never saw its question or the user's answer, so it asked again and the run suspended forever. Tool calls made in the current run, including everything before a suspension, now stay in the prompt after resume. Fixes https://github.com/mastra-ai/mastra/issues/24382
