---
'@mastra/factory': patch
'mastra': patch
---

Simplified `mastra factory dev` startup output. Per-phase `[factory:timing]` lines, per-integration "initialized" lines, and poller/worker "started" lines no longer print on a local dev boot. Instead you see the ready banner (with the Factory UI URL on its own line) and one integrations line showing which integrations are connected and which are available:

```
◇ Integrations: GitHub connected · Jira, Linear, GitLab, incident.io available
```

Run `mastra factory dev --debug` to bring back the boot timings and integration details. Deployed Factories still log boot timings as before.
