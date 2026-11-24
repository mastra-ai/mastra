---
'@mastra/evals': patch
---

Fixed the completeness scorer for text in non-Latin scripts such as Japanese, Chinese, Russian, and Arabic. The scorer ignored this text, so an unrelated answer scored 1 and a correct answer with a number in it scored 0. It now compares the words of every script. Scores for text in Latin letters do not change.
