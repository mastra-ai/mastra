---
'@mastra/fastembed': patch
---

FastEmbed embedding models now throw an error when the model returns a different number of embeddings than input texts, instead of returning a result where embeddings can't be matched to their inputs. The error reports the expected and received counts.
