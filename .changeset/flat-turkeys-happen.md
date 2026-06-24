---
'@mastra/core': patch
'mastracode': patch
---

Fixed thread auto-resume selecting the wrong thread in git worktrees by scoping startup selection to threads tagged with the current project path. When Mastra Code detects a matching project thread on a different resource after resourceId drift, it now prompts before migrating and resuming that thread; accepting the prompt moves the thread and its messages to the current resource, while declining starts fresh and leaves the old resource untouched.
