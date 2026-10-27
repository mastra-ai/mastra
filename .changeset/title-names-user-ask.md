---
'@mastra/core': patch
---

Generated thread titles now name what the user asked for instead of what the assistant replied. Previously a question like "do you have access to acme/api" could be titled with the assistant's answer, or with a reply to the transcript such as "I appreciate you sharing this context, but…". The default title instructions now treat the transcript as material to label and title a question by its subject, for example "Access to acme/api".
