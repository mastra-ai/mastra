---
'@mastra/rag': patch
---

Fixed recursive chunking, and character chunking with an empty separator, cutting emoji and some rare characters in half. Those chunks held broken text that showed up as replacement characters (�) when stored or embedded. Fixes [#29268](https://github.com/mastra-ai/mastra/issues/29268).
