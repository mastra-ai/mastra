---
'@mastra/observability': patch
'@mastra/posthog': patch
---

Fixed traces of a model call that stops for a tool approval or a tool suspension. The call was recorded as two model inference spans, one without its output and one without its input, so exporters that count tokens per model call, such as OpenTelemetry, Datadog and PostHog, counted the call twice. With `@mastra/core` 1.81 or later, it is now one span. Upgrade `@mastra/posthog` together with `@mastra/observability`, so PostHog keeps the tool call and its result in the next call's input.
