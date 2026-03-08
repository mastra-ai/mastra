---
"@mastra/mcp": patch
---

fix: add SIGHUP handler to prevent stdio child process leaks on terminal disconnect

MCPClient now handles SIGHUP alongside SIGINT, SIGTERM, and beforeExit. When a terminal session closes (tmux pane, SSH disconnect, terminal emulator close), the SIGHUP handler triggers graceful shutdown and kills the stdio child process instead of leaving it running as an orphan.
