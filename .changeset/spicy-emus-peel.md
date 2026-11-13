---
'@mastra/core': patch
---

Fixed workspace skills slowing down as allowed paths grow. With one `LocalFilesystem` `allowedPaths` entry per skill directory, `workspace.skills.list()` took about 34 s for 256 skills, and every agent step took seconds. Listing skills and running agent steps now stay fast as you add allowed paths: in that setup the first `list()` takes well under a second, and the skills work in each later step takes tens of milliseconds. Symlinks that point outside every allowed path are still rejected. An allowed path that cannot be resolved, such as a symlink loop, no longer blocks files under the other allowed paths. Fixes [#30224](https://github.com/mastra-ai/mastra/issues/30224).
