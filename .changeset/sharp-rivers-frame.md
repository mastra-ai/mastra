---
'@mastra/core': patch
---

Fixed OpenAI reasoning stripping so replayed memory is sanitized without dropping reasoning from the current agent run. Multi-step loops now keep step-to-step reasoning continuity while remembered history still avoids OpenAI item pairing errors.
