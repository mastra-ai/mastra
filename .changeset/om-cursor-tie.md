---
'@mastra/memory': patch
---

Fixed observational memory dropping an unobserved message created in the same millisecond as the last observed message. Messages at the observation cursor are now kept in context and sent to the Observer when they are not in the observed message ids, and storage loads include the cursor millisecond.
