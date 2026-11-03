---
'@mastra/playground-ui': patch
---

Fixed MCP Apps in Studio:

- Studio now tells apps that it can run server tools and post chat messages, so apps that check host capabilities before using these features (for example, a chart's "View in traces" button) now show them.
- Apps can now hand context to the agent (`ui/update-model-context`). Studio holds the latest context from each app and adds it to the agent's instructions for your next message only, without showing it in the chat. For example, a dashboard drilldown can pass the exact filters you clicked and post a short message.
- An app can call any tool on its own server from the MCP tool playground (previously every call ran the tool being viewed).
- Apps follow Studio's light or dark theme.
