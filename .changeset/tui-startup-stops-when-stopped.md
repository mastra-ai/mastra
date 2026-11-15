---
'mastracode': patch
---

**Fixed startup carrying on after you stop Mastra Code.** If you press Ctrl+C while Mastra Code is still starting, startup now stops. Before, it kept going even though Mastra Code was shutting down. It could take the terminal back, resume and lock a thread, clone a thread from another resource, and connect MCP servers. It could also apply the startup model pack, open onboarding, run SessionStart hooks and send the startup prompt. Text you typed is also no longer submitted after Mastra Code stops.
