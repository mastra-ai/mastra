---
'@mastra/platform-workspace': minor
---

`createRepoTemplate` accepts `buildEnv`: environment variables for the build steps only (for example, remote cache credentials). They never enter the template definition or identity. Template fallback warnings now redact credentials.
