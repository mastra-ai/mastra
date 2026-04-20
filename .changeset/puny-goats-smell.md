---
'@mastra/core': patch
---

Improved error message when `resumeStream()` or `resumeGenerate()` cannot find a suspended run snapshot. Instead of the cryptic "No snapshot found for this workflow run: agentic-loop <runId>", the agent now throws an actionable `AGENT_RESUME_NO_SNAPSHOT_FOUND` error that explains whether storage is missing or the runId is invalid, and suggests remediation steps.
