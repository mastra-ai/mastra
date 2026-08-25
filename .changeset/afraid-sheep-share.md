---
'@mastra/daytona': minor
---

Added a `secrets` option to `DaytonaSandbox` for injecting Daytona Secrets into sandboxes. Map environment variable names to Daytona Secret names and the real value is substituted into HTTPS request headers at egress — the raw credential never enters the sandbox.

```typescript
const sandbox = new DaytonaSandbox({
  secrets: {
    GITHUB_TOKEN: 'github-token',
  },
});
```

Closes https://github.com/mastra-ai/mastra/issues/22314
