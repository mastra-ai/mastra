---
'@mastra/factory': patch
---

Track per-stage automation in Factory metrics. Stage history now stamps the exiting actor (`exitedBy`) alongside the entering one, `isAutomationActor` classifies rules-engine, agent (`agent:*`), and webhook (`github:*`) actors as automation, and `computeFactoryMetrics` reports a `stageAutomation` breakdown per stage: how many passes were fully automated (entered and exited by automation on the first visit) and how those automated passes ended up (`done`, `canceled`, `reworked`, or still in flight). Adds the `canceled` terminal stage to the board vocabulary (`FACTORY_RULE_STAGES`) — a tracked non-completion that feeds neither throughput nor cycle time — and rewords organization-required errors to be auth-provider neutral.
