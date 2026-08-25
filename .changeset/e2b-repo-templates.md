---
'@mastra/e2b': minor
---

**Added repository templates, so sandboxes start with a warm checkout**

`createRepoTemplate()` builds an E2B template with the repository already cloned and its setup command already run. Sessions then start from a prepared image instead of paying a cold clone and install.

```ts
new E2BSandbox({
  id: sessionId,
  template: createRepoTemplate({
    getRepositoryAccess: async () => ({
      cloneUrl: 'https://github.com/acme/widgets.git',
      authorization: { scheme: 'bearer', token: await mintInstallationToken() },
    }),
    setupCommand: 'pnpm install',
  }),
});
```

`getRepositoryAccess` supplies the clone URL and, for private repositories, a short-lived credential. It returns `undefined` from `createRepoTemplate()` when the accessor is absent, so a session with no repository needs no conditional at the call site. The credential authenticates the head lookup and the build's clone through an in-shell auth header, reaching the template definition's environment but never the image filesystem, and it's also exposed to the setup command as `GH_TOKEN` so a command that works in a session works during the build.

**Only the first build ever blocks a start**

There's one template per repository, setup command, and workdir, with the commit sha as a tag (`mastra-repo-<owner>-<repo>-<hash>:sha-<sha>`). Without an explicit `sha` the template pins itself to the repository's current default-branch head at resolution time. When the head moves, the next sandbox boots immediately from the previous build while the new sha builds in the background, and runtime setup fast-forwards the checkout. A failed build falls back to the default template plus a runtime clone, so a broken build never wedges a session.

**Added `buildEnv` for setup commands that need credentials**

Registry tokens, private index URLs, and anything else the setup command needs at build time. Accepts a record or an async resolver. Values are part of the template's identity, so changing one produces a new template.

**Added `refreshRepoTemplate()` for warming templates ahead of time**

The same resolution the lazy start path performs, exposed standalone and awaited, so a cron or a merge-to-main handler can build the template before anyone opens a session.
