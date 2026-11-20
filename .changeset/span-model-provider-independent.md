---
'@mastra/observability': patch
---

Exported spans now carry `model` and `provider` each on its own. Before, a span with only a model attribute (for example a model generation without a provider) exported neither, so model filters on span and trace queries missed it.
