---
'@mastra/posthog': patch
---

Fixed large spans being rejected by PostHog. The exporter now sends `$ai_*` events through posthog-node's dedicated AI capture endpoint (`captureAi()`), which accepts events up to 8 MiB and drops only an oversized event instead of failing the whole batch. Bumps `posthog-node` to `^5.49.0`. Fixes [#23845](https://github.com/mastra-ai/mastra/issues/23845).
