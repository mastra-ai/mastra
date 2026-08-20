---
'@mastra/code-sdk': minor
'mastracode': patch
---

Added experimental peer-to-peer messaging between Mastra Code instances working on the same repository. Instances (including sibling git worktrees) now discover each other automatically and agents get two new tools: `list_peers` to see other live instances (with branch, directory, and pid) and `send_to_peer` to send a fire-and-forget message to one peer or broadcast to all. Incoming peer messages arrive as peer-origin notifications in the inbox — never as user messages — so agents can coordinate work across worktrees without impersonating the user. Enabled by default; opt out with the `signals.experimentalPeers` setting or `MASTRACODE_EXPERIMENTAL_PEERS=0`.
