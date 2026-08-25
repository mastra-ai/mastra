---
'@mastra/memory': patch
---

Knowledge curation no longer fails on Gemini models: the curator's `knowledge_update_node` tool schema was rejected by Google's API ("required only allowed for OBJECT type"), causing every curation attempt with a Gemini curator to fail before the model ran. The tool now accepts the same inputs with `name`/`kind` as optional properties (at least one required).
