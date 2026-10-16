---
'@mastra/factory': patch
---

Added the answering credential to each assistant reply's `content.metadata`.

- `credentialLabel` names the subscription or API key, such as "Claude Pro/Max" or "Anthropic API key".
- `credentialOwnerId` is the user whose personal credential answered. Replies answered by the organization's credential have none.
- Replies written before this change have neither field.

```json
{
  "modelId": "claude-opus-4-6",
  "provider": "anthropic.messages",
  "credentialLabel": "Claude Pro/Max",
  "credentialOwnerId": "user_123"
}
```
