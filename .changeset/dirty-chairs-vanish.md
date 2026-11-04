---
'@mastra/code-sdk': minor
---

Added a `textExtensions` option to `SandboxFilesystem`, so agents working in a remote sandbox can make `grep` search file types it skips by default. It works like the `LocalFilesystem` option: values extend the built-in set and are normalized, so `'sas'`, `'.sas'` and `'.SAS'` are equivalent. Fixes #28365.

```ts
const filesystem = new SandboxFilesystem({
  sandbox,
  workdir: '/workspace/repo',
  textExtensions: ['.sasx'],
});
```
