---
'@mastra/memory': patch
---

Fixed Observational Memory observer and reflector traces to stay in the caller's conversation session, including when child spans arrive before their parents. Internal execution threads remain isolated.
