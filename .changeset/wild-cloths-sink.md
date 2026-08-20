---
'@mastra/factory': patch
---

Improved Factory startup and run kickoff by loading the bundled Factory skills once at startup as agent-owned inline skills. Invoking a bundled skill no longer waits for workspace skill discovery or sandbox materialization, so runs start immediately even before a session sandbox exists. Repository-provided skills (`.mastracode/skills`, `.claude/skills`, `.agents/skills`) are still discovered from the session workspace, now in the background after the sandbox materializes.
