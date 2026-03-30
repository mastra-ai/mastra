---
'@mastra/core': patch
---

Fixed MODEL_GENERATION observability span to include all system messages (tagged and untagged). Previously, working memory and semantic recall instructions were missing from trace inputs because only untagged system messages were captured.
