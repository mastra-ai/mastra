---
'@mastra/code-sdk': minor
---

Added step-based OAuth APIs for browser-driven provider sign-in and tenant-aware credential resolution. Hosted applications can now inject a credential store so each request resolves the caller's credentials without copying stored secrets into process environment variables.

```ts
import { startAnthropicLogin } from '@mastra/code-sdk/auth/providers/anthropic';

const { url, verifier } = await startAnthropicLogin();
```
