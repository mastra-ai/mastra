---
'@mastra/factory': patch
---

Factory Overview now measures the Factory, not the connected repo.

The integrations sync every issue and pull request of a connected repository onto the board, and those cards vastly outnumber the work the Factory actually runs. The Overview counted all of them, so a busy repo reported hundreds of completions, a lead time measured from the moment the poller filed the card, and an automation rate pinned near 100% because the poller stamps itself on every move it makes.

**What changed**

- Throughput, lead time, in-flight, work intake and stage coverage now cover only cards a Factory run was started on.
- **In flight** no longer counts the intake inbox, so it covers the same work as the queue-health chart below it, which already excluded it.
- **Automation coverage** is now **Agent coverage**: the share of each stage's first passes an agent finished, instead of any move no human made. The near-constant automation ratio card is gone.
- **Agents running** previously read threads under the wrong resource and always showed 0. The work-item listing now reports which of the cards it returns have a run in flight, so the count and the 'agent running' marker in the queue-health drill-down come from one read and can't disagree.

`GET /web/factory/projects/:id/work-items` gains `runningSessionIds` alongside `workItems`. `FactoryMetrics` drops `transitions` and renames `stageAutomation` to `agentCoverage` (`exits` → `passes`, `automated` → `byAgent`).
