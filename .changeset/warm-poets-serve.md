---
'@mastra/posthog': minor
---

Added `$ai_tools` to exported `$ai_generation` events. When tool definitions are present on the generation span (requires @mastra/core with tool-definition capture), they are sent to PostHog in the OpenAI function format, so PostHog LLM Analytics shows the tool schemas each generation ran with. Related: #20242
