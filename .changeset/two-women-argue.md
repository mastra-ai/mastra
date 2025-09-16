---
'@mastra/deployer-cloudflare': minor
'@mastra/deployer-netlify': minor
'@mastra/deployer': minor
'@mastra/deployer-vercel': minor
'@mastra/deployer-cloud': minor
---

The `IBundler` and subsequently the `IDeployer` interface changed, making the third argument of `bundle()` an object.

```diff
- bundle(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void>;
+ bundle(entryFile: string, outputDirectory: string, options: { toolsPaths: (string | string[])[]; projectRoot: string }): Promise<void>;
```

If you're just using the deployer inside `src/mastra/index.ts` you're safe to upgrade, no changes needed.
