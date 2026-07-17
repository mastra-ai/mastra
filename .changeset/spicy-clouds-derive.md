---
'@mastra/core': minor
---

Added an optional `clone()` method to the `WorkspaceSandbox` contract, along with the new `SandboxCloneOptions` type. `clone()` constructs an unstarted sibling sandbox that inherits the template's configuration (credentials, image, resources) with per-instance overrides — without performing any I/O. This lets one configured sandbox act as a template for a fleet of sandbox clones (for example, one per project).

```ts
const template = new RailwaySandbox({ token, environmentId });

// Fresh sandbox clone for a project — provisions on start()
const projectSandbox = template.clone({
  id: 'mc-project-42',
  env: { GITHUB_TOKEN: token },
  idleTimeoutMinutes: 30,
});
await projectSandbox.start();
```

`LocalSandbox` implements `clone()` out of the box.
