---
'@mastra/playground-ui': patch
---

Fixed MCP Apps in Studio:

- Studio now tells apps that it can run server tools and post chat messages, so apps that check host capabilities before using these features (for example, a chart's "View in traces" button) now show them.
- MCP App views now accept context updates from the app (`ui/update-model-context`) through a new `onUpdateModelContext` callback, and only advertise that capability when the callback is provided.
- An app can call any tool on its own server from the MCP tool playground (previously every call ran the tool being viewed).
- Apps follow Studio's light or dark theme.
