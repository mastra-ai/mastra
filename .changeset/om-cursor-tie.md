---
'@mastra/memory': patch
---

Fixed observational memory dropping a message created in the same millisecond as the last observed message. When a memory record tracks observed message ids, messages at the observation cursor that are not in those ids now stay in context and are sent to the Observer, while already-observed messages are still excluded. Records without observed message ids behave as before.
