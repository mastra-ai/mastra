---
'@mastra/inngest': patch
---

Fixed Inngest agents starting a reply turn while another tool call from the same step was still running. When one tool call suspends and a sibling call is still working, a message sent to the thread now waits until the sibling finishes. Shutdown and lost thread ownership also see an Inngest run's running tool calls now, as they already did for durable agents. Part of the fix for [#30190](https://github.com/mastra-ai/mastra/issues/30190).
