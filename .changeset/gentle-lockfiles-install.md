---
'@mastra/core': patch
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
'@mastra/deployer-netlify': patch
---

Install generated bundle dependencies from a committed lockfile with `bundler.lockfile`. Generate the lockfile for the bundle's output `package.json`, keep it within the project, and use its basename to select the manager's frozen install command. Automatic manager detection remains unchanged when no lockfile is configured.

```ts
const mastra = new Mastra({
  bundler: {
    lockfile: './bundle-lock/package-lock.json',
  },
});
```
