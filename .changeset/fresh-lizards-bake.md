---
'@mastra/client-js': patch
---

Fix subscribed thread client-tool continuations to avoid resending persisted assistant messages, preventing duplicate OpenAI-compatible reasoning or message item IDs during streaming continuations.
