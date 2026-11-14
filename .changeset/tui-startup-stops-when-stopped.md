---
'mastracode': patch
---

**Fixed startup carrying on after you stop Mastra Code.** If you press Ctrl+C while Mastra Code is still starting, startup now stops. Before, it kept going: it took the terminal back, resumed and locked a thread, connected MCP servers, applied the startup model pack, ran SessionStart hooks and sent the startup prompt, even though Mastra Code was shutting down.
