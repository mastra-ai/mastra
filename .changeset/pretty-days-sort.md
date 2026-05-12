---
'@mastra/core': patch
---

Fixed title generation to send plain text instead of JSON-serialized part objects to the title model. Previously, internal metadata like providerOptions and framework details leaked into the title prompt. Now formats messages using role-prefixed plain text (similar to observational memory formatting), supporting both single-message and multi-turn conversations.
