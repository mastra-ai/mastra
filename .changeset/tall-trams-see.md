---
'@mastra/posthog': patch
---

Fixed generation traces producing stringified JSON in messages instead of structured content. Input messages wrapped as `{messages: [...]}` and output objects with `text` are now properly extracted and formatted.
