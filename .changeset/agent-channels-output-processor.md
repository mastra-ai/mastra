---
'@mastra/core': patch
---

Move stream rendering for chat channels from the per-thread subscription consumer to a per-run output processor. AgentChannels now contributes a `ChatChannelOutputProcessor` via `getOutputProcessors()`; the output processor pumps chunks through the existing streaming/static chat drivers using an async queue, keyed to the run's `RequestContext`. The duplicate background subscription consumer is removed from `processChatMessage` — only the winning Lambda's `ownerStream.consumeStream()` drives rendering, so serverless deployments no longer post duplicate replies when multiple invocations race the same thread. Slash-command and resume paths still use the subscription consumer.
