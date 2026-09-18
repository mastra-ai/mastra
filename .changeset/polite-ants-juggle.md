---
'@mastra/core': patch
---

Fixed tool calls missing from MODEL_GENERATION span output when agents run through the streaming loop or durable workflows. Observability exporters such as PostHog now receive the tool calls, so PostHog's Tools tab and `$ai_output_choices` show them for streamed generations. Fixes #24291
