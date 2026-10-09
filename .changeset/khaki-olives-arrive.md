---
'@mastra/core': patch
---

Fixed cross-process events going missing after a process restarted. Processes that share a socket, such as Mastra Code sessions, could split into separate groups that never received each other's events. A message sent from one session to another could then fail to arrive until every process restarted. A restart, a busy machine briefly refusing connections, or a deleted socket file could cause the split.

- Refused connections are retried before a process takes over the socket.
- A broker removes the socket path only while it still points at its own socket.
- A broker that loses its socket path rejoins the shared group automatically.
