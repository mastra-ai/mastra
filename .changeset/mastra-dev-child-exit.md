---
"mastra": patch
---

Fixed `mastra dev` shutdown and hot reload so the CLI waits for the child server process to exit (with a short SIGKILL fallback) and handles SIGHUP like SIGINT and SIGTERM, reducing orphaned processes and port-in-use errors.
