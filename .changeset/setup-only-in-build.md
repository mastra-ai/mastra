---
'@mastra/factory': patch
---

Sessions no longer run repository setup commands when the Factory's environment is built as a template. Setup runs only in the environment build, so a session never reruns a 15-minute setup.

A session boots only a build of the environment as saved. Before the first build finishes, or after a saved change to the sandbox settings, repositories, setup commands or Build variables, sandbox commands fail fast with a message saying the environment is being built. Factory starts a build if none is running and notifies each waiting session when the build ends. If the build of a saved change fails, sessions boot the previous build and the agent is told the change failed to build. A failed build isn't retried on every command; start another from the environment settings page.

The repositories page now shows the setup result of the environment build, not failures from a session's own boot.
