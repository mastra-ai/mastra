---
'@mastra/factory': minor
---

Board routes can now move cards when labels or assignees change, and when a pull request is reopened.

**New events** — `work_item.updated` fires when an item's labels or assignees change; `pull_request.updated` fires for a pull request attached to a card; `pull_request.reopened` moves a card only where a route names it. The event `work_item.created` is now `work_item.opened`; stored routes using the old name keep working, and API requests may send the old name for one release.

**New filters** — `event.labels.added`, `event.labels.removed`, `event.assignees.added`, `event.assignees.removed`, `card.phase`, `item.hasPullRequest` and `item.hasIssue`.

**Behavior** — changes the card's own session makes are held until its run ends and combined into one event. Changes people make are evaluated after about five seconds, with a burst combined into its net change; like every route move, a move into a phase that isn't terminal still waits for a run in flight. A move made by a rule never triggers an update. A reopened GitHub or GitLab issue with no card is now filed like a new one.

```json
{
  "on": ["work_item.updated"],
  "when": { "operator": "AND", "conditions": [{ "field": "event.labels.added", "operator": "contains", "value": "ship" }] },
  "target": { "boardKey": "work", "phaseKey": "done" }
}
```
