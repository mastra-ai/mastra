---
'@mastra/code-sdk': patch
'mastracode': patch
---

Removed the `payload` parameter from the `agent_signal_send` tool. Peer agents never received it: only `summary` is delivered, so senders could put important content in `payload` and the recipient would silently miss it. The `summary` description now states that it is the full message delivered to the peer.
