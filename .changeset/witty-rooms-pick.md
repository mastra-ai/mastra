---
'@mastra/fastembed': patch
---

Fixed empty dense and sparse embeddings when custom tokenizer metadata omits model_max_length or sets it to null ([#28236](https://github.com/mastra-ai/mastra/issues/28236)). The requested limit or default 512-token limit is preserved.
