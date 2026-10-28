---
'@mastra/factory': patch
---

Fixed the run error card when Factory's own event store runs out of memory. Instead of the raw `OOM command not allowed` reply, the web and Slack cards now say Factory is unavailable, that the request and model provider are fine, and to contact the Factory administrator before continuing.
