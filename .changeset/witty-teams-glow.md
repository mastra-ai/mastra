---
'@mastra/factory': minor
---

Added **Apply to running sessions** for your saved default model. It switches your running user sessions right away and reports which sessions were updated and which were skipped (stopped, Factory-billed, or failed).

Interactive sessions can also call `factory_switch_session_model` to change the model of a side, work item, or review session you own in the same Factory. It only accepts models this server can run:

```json
{ "sessionId": "session-1", "modelId": "openai/gpt-5.6" }
```
