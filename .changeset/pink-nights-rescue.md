---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed `agent_signal_send` so senders put content where the peer can see it. The `payload` parameter was removed because peers never received it, and the `summary` parameter was renamed to `message` to make clear it is the full message delivered to the peer.

The tool result now reports only the routing outcome instead of echoing the whole message back to the sender. Mastra Code still shows the target, routing options, full message, and outcome in a dedicated tool display.
