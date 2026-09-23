---
'@mastra/factory': patch
---

Slack sessions now start on the model the linked sender picked in their own model pack, instead of always using the factory project's default model. When the sender has no active pack, the factory project default still applies, and when neither exists the session keeps the built-in default.

The model a conversation starts on is now recorded on that conversation, so every later message and every restart keeps using it rather than re-checking preferences that may have changed since. Conversations that already have a model are left alone.
