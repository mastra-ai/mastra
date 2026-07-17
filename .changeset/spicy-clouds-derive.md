---
'@mastra/core': minor
---

Added an optional `derive()` method to the `WorkspaceSandbox` contract, along with the new `SandboxDeriveOptions` type. `derive()` constructs an independent sibling sandbox that inherits the template's configuration (credentials, image, resources) with per-instance overrides — without performing any I/O. This lets one configured sandbox act as a template for a fleet of sandboxes (for example, one per project).

```ts
const template = new RailwaySandbox({ token, environmentId });

// Fresh sandbox for a project — provisions on start()
const projectSandbox = template.derive({
  id: 'mc-project-42',
  env: { GITHUB_TOKEN: token },
  idleTimeoutMinutes: 30,
});
await projectSandbox.start();
```

`LocalSandbox` implements `derive()` out of the box.
