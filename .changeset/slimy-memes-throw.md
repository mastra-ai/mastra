---
'@mastra/factory': patch
---

Added `owner` to the session model catalog (`GET /web/config/models?resourceId=…&threadId=…`). It lists, per model provider, the credential type answering the thread: an API key, or the subscription it bills. Whose credential it is follows `modelScope`: the organization's, or the session owner's, whom `GET /web/user-sessions/:sessionId` already names.

```json
{
  "modelScope": "user",
  "owner": {
    "credentials": {
      "anthropic": { "type": "oauth", "subscription": "Claude Pro/Max" },
      "openai": { "type": "api_key" }
    }
  }
}
```
