---
'@mastra/factory': minor
---

Added an action to apply your saved default model to running user sessions without recreating them. Interactive user sessions can also use `factory_switch_session_model` to change the model of another session they own in the same Factory, even if it is stopped; the change takes effect on its next run. User sessions also use their personal Observer and Reflector model settings rather than the Factory project's settings.
