---
'@mastra/core': patch
---

Fixed cross-process events that went missing after a process restarted. Processes sharing a socket (such as Mastra Code sessions) could split into separate groups that never heard each other's events, so a message sent from one session to another could fail to arrive until every process restarted. Restarting a process, a busy machine briefly refusing connections, or a deleted socket file could all cause the split. A process now only takes over a socket after proving its owner is gone, never removes another process's socket, and rejoins the shared group by itself if it ends up cut off.
