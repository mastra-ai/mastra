---
'@mastra/server-adapters-test-suite': patch
'@mastra/server': patch
---

Fixed run resume and time-travel conflict responses to include a machine-readable code alongside the existing error message across server adapters. HTTP status remains 409, with a JSON body such as:

```json
{
  "error": "Run conflict",
  "code": "AGENT_RESUME_ALREADY_CLAIMED"
}
```

The shared handler exposes these conflict codes: `AGENT_RESUME_ALREADY_CLAIMED`, `WORKFLOW_RESUME_ALREADY_CLAIMED`, `AGENT_RESUME_RUN_NOT_SUSPENDED`, `WORKFLOW_RUN_NOT_SUSPENDED`, `WORKFLOW_TIME_TRAVEL_ALREADY_CLAIMED`, and `WORKFLOW_TIME_TRAVEL_RUN_RUNNING`.
