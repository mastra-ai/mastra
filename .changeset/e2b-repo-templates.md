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

`getRepositoryAccess` supplies the clone URL and, for private repositories, a short-lived credential. It returns `undefined` from `createRepoTemplate()` when the accessor is absent, so a session with no repository needs no conditional at the call site. The credential authenticates the head lookup and the build's clone through an in-shell auth header, reaching the template definition's environment but never the image filesystem. It's set as `GH_TOKEN`, the same variable a session installs before running setup, so a setup command behaves identically in both places.

**Only the first build ever blocks a start**

There's one template per repository, setup command, and workdir, with the commit sha as a tag (`mastra-repo-<owner>-<repo>-<hash>:sha-<sha>`). Without an explicit `sha` the template pins itself to the repository's current default-branch head at resolution time. When the head moves, the next sandbox boots immediately from the previous build while the new sha builds in the background, and runtime setup fast-forwards the checkout. A failed build falls back to the default template plus a runtime clone, so a broken build never wedges a session.

**Added `buildEnv` for setup commands that need credentials**

Registry tokens, private index URLs, and anything else the setup command needs at build time. Accepts a record or an async resolver. Values are part of the template's identity, so changing one produces a new template.

**Added `refreshRepoTemplate()` for warming templates ahead of time**

The same resolution the lazy start path performs, exposed standalone and awaited, so a cron or a merge-to-main handler can build the template before anyone opens a session.

**Default template ships a current Node.js LTS with corepack enabled**

The e2b base image carries Node 20.9.0, old enough that corepack-fetched package managers crash on it, so a setup command like `pnpm i && pnpm build` failed out of the box. The default mountable template now installs a pinned Node 24.20.0 over the stale runtime and enables corepack with the download prompt disabled, so `pnpm` and `yarn` resolve to whatever a repository's `packageManager` field pins. Repo templates build on the default mountable template, so they inherit the working toolchain. Pick a different release with the new `nodeVersion` option:

```ts
createDefaultMountableTemplate({ nodeVersion: '22.23.2' });
```

The version is exact and identity-bearing: changing it builds a new template, so a version change can never silently reuse a build at the old runtime. Existing default and repo templates rebuild once on first use after upgrading.

**Machine resources: `cpuCount` and `memoryMB`**

The built template's sandboxes get exactly that machine size. Resources are part of the template's identity — hashed into the template name alongside the repository, setup command, and build env — so a resize builds a new template instead of silently reusing one built at the old size. Absent options normalize to the SDK defaults (2 vCPU, 1024 MB). When a repo template's build fails and the sandbox degrades to the default mountable template, the default is built at the requested size too, so a 2 GB session's setup never lands in a 1 GB fallback and runs out of memory.

```ts
new E2BSandbox({
  id: sessionId,
  template: createRepoTemplate({ ...ctx, memoryMB: 2048, cpuCount: 4 }),
});
```
