---
'@mastra/factory': minor
---

Added an action to apply your saved default model to running user sessions without recreating them. Interactive user sessions can also use `factory_switch_session_model` to change the model of another running session they own in the same Factory; the change takes effect on its next run.
