---
'@mastra/factory': minor
---

Board routes can now move cards when labels or assignees change, and when a pull request is reopened.

**Two event families** — `work_item.*` events are about issues; every pull or merge request event is `pull_request.*`. A route on `work_item.opened` files new issues, and a route on `pull_request.opened` files new pull requests with no card (and moves an issue's card when its pull request opens). `work_item.created` keeps its meaning: it files new issues and new pull requests alike, so existing routes, and routes created without `on`, behave as before. New projects get their pull request routes on `pull_request.opened`.

**New events** — `work_item.updated` fires when an issue's labels or assignees change, and `pull_request.updated` when a pull request's do, on its own card or an issue card it is attached to; `pull_request.reopened` moves a card only where a route names it. A reopened pull request with no card is filed like a new one, and a pull request no board took (Not routed) is filed once a label or assignee change makes a board's rule match.

**New filters** — `event.labels.added`, `event.labels.removed`, `event.assignees.added`, `event.assignees.removed`, `card.phase`, `item.hasPullRequest` and `item.hasIssue`.

**Behavior** — changes the card's own session makes are held until its run ends and combined into one event. Changes people make are evaluated after about five seconds, with a burst combined into its net change; like every route move, a move into a phase that isn't terminal still waits for a run in flight. A move made by a rule never triggers an update. A reopened GitHub or GitLab issue with no card is now filed like a new one.

```json
{
  "on": ["work_item.updated"],
  "when": { "operator": "AND", "conditions": [{ "field": "event.labels.added", "operator": "contains", "value": "ship" }] },
  "target": { "boardKey": "work", "phaseKey": "done" }
}
```
