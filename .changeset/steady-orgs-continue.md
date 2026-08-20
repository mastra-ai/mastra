---
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Interactive messages and model switches on factory sessions now resolve provider credentials org-first (org > user), matching board-run kickoff. The credential resolver keys off the session's `factoryProjectId` in controller state, so any run on a factory-owned session rides the org's shared keys with the caller's personal credentials as fallback — switching to a personal-only model still works through that fallback. Repo-backed Slack channel sessions now stamp the owning factory project onto session state so they get the same behavior.
