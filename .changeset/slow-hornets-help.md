---
'@mastra/server': minor
---

The create-session endpoint (POST /agent-controller/:controllerId/sessions) accepts optional modeId/modelId to seed a newly created session's initial mode and model, and reports the session's actual modeId/modelId back in the response. GET /agent-controller/:controllerId/modes now includes each mode's default flag and defaultModelId, so UIs can show truthful defaults before any session exists.
