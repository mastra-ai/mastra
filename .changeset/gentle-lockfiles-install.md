---
'@mastra/core': patch
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
'@mastra/deployer-netlify': patch
---

Install generated bundle dependencies from a committed lockfile with `bundler.lockfile`. The lockfile's basename selects the package manager, the file must stay within the project, and the bundle uses the manager's frozen install command. Automatic manager detection remains unchanged when no lockfile is configured.

```ts
const mastra = new Mastra({
  bundler: {
    lockfile: './package-lock.json',
  },
});
```
