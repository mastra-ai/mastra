---
'@mastra/factory': patch
---

Session agents now know when their sandbox is still running its setup command. While setup runs (a monorepo build can take up to 15 minutes), even `echo ok` can time out, and agents read that as a dead sandbox: they tried to recreate it, were refused, and went quiet. The agent's environment now says which setup command is running, when it started and when it will be stopped, and says so once setup has ended. `factory_recreate_sandbox` refuses to throw a running setup away.

The mark is stored on the session row (new nullable `setup_target`, `setup_started_at` and `setup_deadline_at` columns on `source_control_sessions`), so a process other than the one running setup can still tell the agent, and it lapses at its deadline if the process running setup dies.
