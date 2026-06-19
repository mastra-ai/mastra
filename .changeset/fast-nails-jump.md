---
'mastracode': minor
---

Added ACP (Agent Client Protocol) server mode. Run `mastracode --acp` to start mastracode as an ACP server over stdio, allowing any ACP-compatible client (Zed, custom editors) to create sessions, send prompts, and receive streamed tool calls and text via the standardized JSON-RPC protocol.
