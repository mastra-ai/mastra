---
'mastracode': minor
---

Added native settings panels for installed plugins. Boolean toggles, text inputs, and select choices stay local until Save; validation and persistence failures remain visible in the panel.

Previously, plugin slash commands submitted Markdown to the model. With a plugin that declares a preferences settings command, open its panel directly:

```text
/preferences
```

Save persists the validated settings without a model call. Cancel discards edits, and switching threads or reloading the plugin closes the old panel.
