---
'@mastra/code-sdk': minor
---

Editors that connect to Mastra Code over ACP (Agent Client Protocol), such as Zed and JetBrains IDEs, can now sign you in without leaving the editor.

- Sign in with a ChatGPT subscription, Kimi For Coding, or xAI in the browser, started from the editor.
- Editors that support terminal sign-in also get Claude and GitHub Copilot sign-in, plus `mastracode-login` for any other provider or an API key. Each runs `mastracode login` in a terminal.
- Starting a session with no configured provider returns an `auth_required` error, so editors show these sign-in options instead of a session with no usable model.

```ts
const { authMethods } = await connection.initialize({
  protocolVersion: PROTOCOL_VERSION,
  clientCapabilities: { auth: { terminal: true } },
});
// openai-codex, kimi-for-coding, xai, anthropic, github-copilot, mastracode-login

await connection.authenticate({ methodId: 'openai-codex' });
```
