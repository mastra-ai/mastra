---
'@mastra/playground-ui': patch
---

Improved the chat/settings switch on the agent page in Mastra Studio. Opening settings now animates as one choreographed motion: the chat composer slides down and out while the settings panel slides in from under the header, and closing reverses it. The switch no longer flashes a scrollbar mid-transition. Browsers without the View Transitions API fall back to a simple fade.
