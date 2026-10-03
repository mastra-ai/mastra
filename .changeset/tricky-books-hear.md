---
'@mastra/code-sdk': patch
---

Editors that connect to Mastra Code over ACP (Agent Client Protocol), such as Zed and JetBrains IDEs, can now sign you in without leaving the editor.

- Sign in with a ChatGPT subscription, Kimi For Coding, or xAI in the browser, started from the editor.
- Use the `mastracode-login` terminal method for other providers or API keys.
- Starting a session with no configured provider returns an `auth_required` error, so editors show these sign-in options instead of a session with no usable model.
