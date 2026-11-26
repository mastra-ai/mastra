---
'@mastra/platform': minor
'@mastra/platform-workspace': patch
'@mastra/agent-browser': patch
---

Changed `PlatformBrowser` to start hosted browsers through your project's workspace on Mastra Platform. It now drives them with the same tools as `AgentBrowser` instead of Stagehand, gives each thread its own browser by default, and ends each browser when its thread or the agent is done. It reads `MASTRA_ENVIRONMENT_ID` alongside the existing platform variables, and errors say when hosted browsers aren't available for the project or the organization has started too many. The `apiUrl` and `cdpUrl` options were removed.
