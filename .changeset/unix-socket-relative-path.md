---
'@mastra/core': patch
---

Fixed `UnixSocketPubSub` intermittently failing to start a broker when the socket path is a bare relative name like `events.sock` or `./events.sock`. The broker's random private socket name could look like a number (for example `.28381e422682`), which Node treated as a TCP port and rejected `subscribe()` with `ERR_SOCKET_BAD_PORT` or `ENOENT`. The private socket path now always keeps its `./` prefix.
