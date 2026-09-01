---
'@mastra/factory': patch
---

Session repo directory resolution now reads a remote sandbox's declared `workingDirectory` when it is an absolute path, placing the checkout at `<workingDirectory>/<repo>` without probing the VM's default cwd. When the option is absent or not absolute, the probe behavior is unchanged.

```ts
new MastraFactory({
  sandbox: ctx => new PlatformSandbox({ id: ctx.sessionId, workingDirectory: '/workspace' }),
});
```
