---
'@mastra/playground-ui': minor
---

The chat now renders a tool's custom Studio component (`ui.studioComponent`) in place of the default tool card. Hosts provide the components through the new `ToolStudioComponentsProvider`. The default card is still shown while a call waits for approval or is suspended, and when the component fails to load or throws.
