---
'@mastra/factory': patch
---

Factory now records which credential answered each assistant reply in the message's `content.metadata`: `credentialLabel` names the subscription or API key, and `credentialOwnerId` is the user whose personal credential it was. A reply answered by the organization's credential has no `credentialOwnerId`.

```json
{
  "modelId": "claude-opus-4-6",
  "provider": "anthropic.messages",
  "credentialLabel": "Claude Pro/Max",
  "credentialOwnerId": "user_123"
}
```
