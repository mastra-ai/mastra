---
'@mastra/core': minor
---

Added `buildEnv` and `buildEnvRevision` to `FactorySandboxContext`. Factory uses them to pass a factory's Build environment variables to template builds and setup steps without putting the values in the template identity. A provider should include `buildEnvRevision` (a random id that changes whenever the values change) in its template identity so an edit rebuilds the template. Both fields are optional, so existing providers compile unchanged.

If your provider spreads the context into a repository template (for example `createRepoTemplate({ ...ctx })`), take these two fields out of the spread first. Otherwise the values reach the template's own `buildEnv` option, which can put them in the template name or the image:

```ts
const { buildEnv, buildEnvRevision, ...rest } = ctx;
// Pass buildEnv only to an option your builder keeps out of identity and the image,
// and add buildEnvRevision to the template identity.
return createRepoTemplate({ ...rest, buildEnvRevision });
```
