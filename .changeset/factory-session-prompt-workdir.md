---
'@mastra/factory': patch
---

Pin Factory session agents to their session workdir. The agent system prompt derives its working directory from `state.projectPath`, which for Factory sessions inherited the controller-global default — the web server's own checkout. Review agents would `cd` into the host repository and run `gh pr checkout` there, mutating the developer's working tree instead of the session sandbox. The session workspace factory now seeds `projectPath`/`projectName` with the resolved sandbox workdir when the session is created and self-heals live state on later requests.
