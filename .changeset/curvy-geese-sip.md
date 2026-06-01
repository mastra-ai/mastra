---
'@mastra/playground-ui': patch
---

Improved studio load time by only bundling the CodeMirror and Shiki languages the editor actually uses, and removed a redundant TypeScript pass from the playground-ui build.
