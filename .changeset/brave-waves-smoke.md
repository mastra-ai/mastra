---
'@mastra/code-sdk': patch
---

Fixed revoked or invalid OAuth sign-ins showing a raw API error. When Anthropic, OpenAI Codex, GitHub Copilot, xAI, or Kimi For Coding rejects a stored sign-in with a 401, the error is now a `ProviderAuthRequiredError` that says the sign-in was rejected, the same as a missing sign-in. Hosts can match on the error name to prompt the user to sign in again.

```ts
if (error.name === 'ProviderAuthRequiredError') {
  // e.g. "Anthropic rejected the stored sign-in: OAuth access token is invalid."
  promptSignIn();
}
```
