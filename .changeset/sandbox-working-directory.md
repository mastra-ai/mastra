---
'@mastra/core': minor
'@mastra/agentcore': minor
'@mastra/apple-container': minor
'@mastra/blaxel': minor
'@mastra/cloudflare-sandbox': minor
'@mastra/daytona': minor
'@mastra/docker': minor
'@mastra/e2b': minor
'@mastra/modal': minor
'@mastra/platform-workspace': minor
'@mastra/railway': minor
'@mastra/vercel': minor
---

**Added a `workingDirectory` option to `MastraSandboxOptions`, honored by every sandbox provider**

Every sandbox now accepts one instance-level `workingDirectory` option that sets the default directory for command execution and process spawns. A per-command `cwd` always wins over it, and when neither is provided each provider keeps its previous default (E2B home, docker `/workspace`, Vercel serverless `/tmp`, and so on). The effective value is readable through the new `sandbox.workingDirectory` getter.

```ts
const sandbox = new E2BSandbox({ workingDirectory: '/home/user/my-repo' });
await sandbox.executeCommand('pwd'); // /home/user/my-repo
await sandbox.executeCommand('pwd', [], { cwd: '/tmp' }); // /tmp
```

Providers that already carried this concept under other names keep those names working as deprecated aliases feeding the same field: `workingDir` on `@mastra/docker` and `@mastra/apple-container`, and `workdir` on `@mastra/modal`. When both the alias and `workingDirectory` are set, `workingDirectory` wins. Use absolute paths: the value is passed to the provider as-is, so `~` and environment variables like `$HOME` are not expanded (except where a provider documents expansion, such as `LocalSandbox` expanding `~`).
