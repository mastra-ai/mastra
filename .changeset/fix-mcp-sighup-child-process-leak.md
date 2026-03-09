---
"@mastra/mcp": patch
---

Fixed stdio child processes leaking when a terminal session closes. MCPClient now handles SIGHUP alongside SIGINT, SIGTERM, and beforeExit, so closing a tmux pane, SSH session, or terminal emulator properly shuts down child processes instead of leaving them as orphans.
