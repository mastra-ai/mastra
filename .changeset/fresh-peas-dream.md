---
'@mastra/core': patch
---

Fixed thread title generation receiving each conversation message twice. The duplicated transcript confused small title models into replying to the conversation instead of producing a title, so threads could get refusal text as their title.
