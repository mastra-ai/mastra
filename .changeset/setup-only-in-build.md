---
'@mastra/factory': patch
---

Sessions no longer run repository setup commands when the Factory's environment is built as a template. Setup runs only in the environment build, so a session starts from the last finished build right away instead of rerunning a 15-minute setup. A repository whose setup command isn't in that build yet reports setup `not built` until the next build.

Before the first build finishes, sandbox commands fail fast with a message saying the environment is being built, or why its build failed. Factory starts a build if none is running and notifies each waiting session when the build ends. A failed build isn't retried on every command; start another from the environment settings page.

The repositories page now shows the setup result of the environment build, not failures from a session's own boot.
