---
'@mastra/core': patch
---

Fixed Windows absolute paths breaking workspace skill discovery. `WorkspaceSkills` split paths on `/` only, so a skill referenced by an absolute Windows path loaded with the wrong name (the full path string or `unknown`) or failed to load, and skills under `node_modules` were misclassified as local instead of external.

Skills passed by absolute path now resolve the same way on Windows and POSIX:

```ts
new Workspace({
  skills: ['C:\\Users\\me\\skills\\my-skill'],
});
```
