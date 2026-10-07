---
'@mastra/core': patch
---

Fixed cross-process events that went missing after a process restarted. Processes sharing a socket (such as Mastra Code sessions) could split into separate groups that never heard each other's events, so a message sent from one session to another could fail to arrive until every process restarted. Restarting a process, a busy machine briefly refusing connections, or a deleted socket file could all cause the split. Refused connections are now retried before a process takes over the socket, a broker only removes the socket path while it still points at its own socket, and a broker that loses its path rejoins the shared group by itself.
