---
'@mastra/core': patch
---

Fixed workspace skills slowing down as allowed paths grow. With one `LocalFilesystem` `allowedPaths` entry per skill directory, `workspace.skills.list()` took about 34 s for 256 skills, and every agent step took seconds. Each file operation now checks only the allowed path that contains the file, and the skills processor reads the skill list once per step. Symlinks that point outside every allowed path are still rejected. An allowed path that cannot be resolved, such as a symlink loop, no longer blocks files under the other allowed paths. Fixes [#30224](https://github.com/mastra-ai/mastra/issues/30224).
