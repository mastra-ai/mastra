---
'@mastra/posthog': patch
---

Fixed large spans being rejected by PostHog. The exporter now sends `$ai_*` events through posthog-node's dedicated AI capture endpoint (`captureAi()`), which accepts events up to 8 MiB and drops only the oversized event instead of failing the whole batch. Previously, one span over ~1 MB caused an HTTP 413 on the analytics endpoint, was dropped, and left the client sending one event per request afterwards. Requires `posthog-node` 5.49.0 or newer. Fixes [#23845](https://github.com/mastra-ai/mastra/issues/23845).
