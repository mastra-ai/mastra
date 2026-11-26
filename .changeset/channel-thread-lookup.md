---
'@mastra/core': minor
---

Added `resolveChannelRenderContext(requestContext, channels)`, which finds the chat thread a run posts into: the one the message came in on, or, for runs started elsewhere (web UI, schedule, signal wake), the chat thread the run's memory thread is linked to. Reply mode uses the same lookup, so tools of your own can post to the same thread.
