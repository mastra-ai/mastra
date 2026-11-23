---
'@mastra/factory': patch
---

Fixed session agents giving up on a sandbox that was still running its setup command. While setup runs (a monorepo build can take up to 15 minutes), even `echo ok` can time out, and agents read that as a dead sandbox: they tried to recreate it, were refused, and went quiet. The agent's environment now says which setup command is running, when it started and when it will be stopped, and says so once setup has ended. `factory_recreate_sandbox` refuses to throw a running setup away.

Setup status is visible to every Factory process serving the session, and it expires on its own if the process running setup stops.
