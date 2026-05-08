## 13. Mastra Server integration

A `Harness` is registered on a `Mastra` instance the same way agents and workflows are. The server auto-mounts a stable HTTP surface, and consumers can talk to the harness either in-process (via `mastra.getHarness(...)`) or remotely (via the client SDK). Code that holds a `Session` reference doesn't care which.
