---
"@mastra/core": patch
---

fix(agent): use unique runId per parallel workflow tool call (#13473)

Generate a unique runId for each fresh workflow tool call to prevent parallel calls from sharing the same cached Run instance. For resume cases, correctly fall back to the outer runId when suspendedToolRunId is not present (manual resume via resumeStream/resumeGenerate).
