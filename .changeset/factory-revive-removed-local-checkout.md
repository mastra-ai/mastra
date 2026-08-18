---
'@mastra/factory': patch
---

Recover a local Factory session whose checkout is removed while a turn is still running. Session retirement deletes the local working directory when a work item finishes, but an in-flight run keeps its sandbox handle, so every later filesystem or command tool spawned into a directory that no longer existed and failed with `spawn /bin/sh ENOENT`. That error names the shell rather than the sandbox, so it was not recognized as a dead sandbox and the revival ladder never ran, wedging the session for the rest of the run (including GitHub token refresh). A missing working directory is now treated as the local equivalent of a destroyed sandbox and triggers the same rebuild-and-retry path. A missing *command* reports the same ENOENT code, so the working directory is probed to tell the two apart and healthy sandboxes are never rebuilt for an unknown command.
