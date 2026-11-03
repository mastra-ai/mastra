---
'@mastra/mysql': patch
---

Fixed two concurrent Knowledge page creates with the same key failing with a raw duplicate-entry error; the loser now gets a key conflict error, like the other storage adapters.
