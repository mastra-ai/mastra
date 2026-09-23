---
'@mastra/factory': patch
---

Slack sessions now start on the model the linked sender picked in their own model pack, instead of always using the factory project's default model. When the sender has no active pack, the factory project default still applies, and when neither exists the session keeps the built-in default.

The model a conversation starts on is now recorded on that conversation, so every later message and every restart keeps using it rather than re-checking preferences that may have changed since. Conversations that already have a model are left alone.

Slack sessions also observe with the linked sender's own observational-memory settings — observer and reflector models, thresholds, and attachment handling — instead of the factory project's shared settings. Anything the sender has not configured themselves keeps following the project.
