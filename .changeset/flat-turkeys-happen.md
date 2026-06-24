---
'@mastra/core': patch
'mastracode': patch
---

Fixed thread auto-resume selecting the wrong thread in git worktrees by scoping startup selection to threads tagged with the current project path. When Mastra Code detects a matching project thread on a different resource after resourceId drift, it now prompts before cloning and resuming that thread under the current resource; accepting the prompt leaves the old thread untouched and loads the clone, while declining starts fresh and leaves the old resource untouched.
