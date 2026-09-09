---
'@mastra/memory': patch
---

- Fixed Langfuse session correlation for Observational Memory observer and reflector traces, including spans received before their parent spans.
- Preserved the supplied observability context when explicitly triggering asynchronous observation buffering.
