---
'@mastra/fastembed': patch
---

Fixed custom FastEmbed models failing to load when `tokenizer_config.json` stores `pad_token` as a serialized AddedToken object (as exported by older Transformers versions).
