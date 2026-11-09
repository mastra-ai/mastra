---
'@mastra/memory': patch
---

Fixed durable and evented agents writing two or three semantic recall vector rows for every message. Duplicate rows took up `topK` slots and made recall return fewer distinct messages. Each message now has one vector row per chunk, keyed by its message id, whichever engine runs the agent.

Saving a message again with `memory.saveMessages()` now replaces its vector rows instead of adding new ones. Rows already written by earlier versions are left as they are.
