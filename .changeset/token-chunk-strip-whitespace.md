---
'@mastra/rag': patch
---

Fix the `token` chunking strategy ignoring `stripWhitespace: false`. `TokenTransformer.fromTikToken()` now forwards `stripWhitespace`, `addStartIndex`, and `separatorPosition` to the transformer instead of silently dropping them, so chunks produced with `overlap: 0` and `stripWhitespace: false` rejoin to the original text.
