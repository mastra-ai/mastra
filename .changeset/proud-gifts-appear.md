---
'@mastra/playground-ui': patch
---

Fixed dropdown, combobox, select, and popover popups silently failing to render when opened outside a side panel (most visibly the model and provider pickers in the chat composer). The shared portal-container resolver now always falls back to the document body instead of leaking an unrenderable value.
