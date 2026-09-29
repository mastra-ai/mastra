---
'@mastra/rag': patch
---

Fixed markdown, LaTeX, and language-based (`fromLanguage`) chunking writing the separator's regex pattern into chunk text. Merged chunks now contain the text that was actually in the document, so `## Install` stays `## Install` instead of becoming `#{1,6} Install`. Fixes #25334.
