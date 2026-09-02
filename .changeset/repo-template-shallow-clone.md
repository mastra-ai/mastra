---
'@mastra/e2b': patch
'@mastra/platform-workspace': patch
---

Repo templates now clone with `--depth=1 --single-branch`, the same clone Factory makes at session start when no template image is available, so both paths produce the same checkout and template builds transfer far less history.
