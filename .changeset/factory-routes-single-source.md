---
'@mastra/factory': minor
---

Intake routes now decide where every new card lands. Label routes and a source binding's board are gone, and Work stays the default board through an editable route instead of a hardcoded fallback.

**Why.** Where a card landed used to depend on five things: intake routes, GitHub label routes, the board on a source binding, the board and phase an integration's rule named, and a fallback to Work. Only some of them were visible, and they could disagree. Now one ordered list per project decides, and admins can see and change all of it.

**Everything else goes to Work › Intake.** Every project gets a new default route, added once at the end of its routes: it has no condition and sends every new card no other route takes to Work › Intake, which is where those cards landed before. Point it at another board to send there every new card the routes above it don't take. A deleted default is not added back. A new route that places new cards now goes just ahead of the first enabled route with no condition that takes every new card, whoever added it, so it can match; a route that only handles status events goes at the end.

```bash
# Send every new card no other route takes to the Docs board.
curl -X PATCH "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes/$EVERYTHING_ELSE_ROUTE" -H 'content-type: application/json' -d '{
  "target": { "boardKey": "docs" },
  "expectedRevision": 1
}'
```

**Edit routes in Settings.** Settings › Work Intake › Intake routes lists the project's routes in the order they are tried. Admins can turn routes on and off, reorder, edit, add and delete them, and use **Send new cards to** to send every new card the routes above the catch-all don't take to another board (outside authors' items and pull requests still go to Work through their own routes unless you change those too), which also copies the close, reopen and pull request routes onto that board. Everyone else sees them read-only. `GET /web/factory/projects/:id/intake-routes` now also returns `canEdit`.

**Route on any fact of the work item.** Routes and phase rules can now test where an item lives and what the provider says about it: `source.repository` (GitHub repository or GitLab project path, Linear team key, Jira project key), `source.provider`, `item.key` (`acme/app#42`, `ENG-12`), `item.state` and `item.assignees`. Strings compare case-insensitively. A list fact (`item.labels`, `item.assignees`) now matches `equals`, `not_equals`, `in` and `not_in` by its members, and an empty list counts as missing, so `item.assignees exists` matches only assigned items. Before, `equals` never matched a label and `item.labels exists` matched every card.

```bash
# Send one repository's issues and pull requests to the Docs board.
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes" -H 'content-type: application/json' -d '{
  "name": "acme/docs goes to Docs",
  "when": { "operator": "AND", "conditions": [
    { "field": "source.repository", "operator": "equals", "value": "acme/docs" }
  ] },
  "target": { "boardKey": "docs" }
}'
```

**Removed: label routes and binding boards.** Use an intake route with any condition on the work item instead, such as `item.labels contains release` or `source.repository equals acme/app`.

```bash
# Before: send GitHub issues labelled "release" to the Release board
curl -X PUT "$FACTORY_URL/web/intake/label-routes" -d '{"factoryProjectId":"…","integrationId":"github","label":"release","board":"release"}'

# After: an intake route on the project
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes" -H 'content-type: application/json' -d '{
  "name": "Releases go to Release",
  "when": { "operator": "AND", "conditions": [
    { "field": "item.labels", "operator": "contains", "value": "release" },
    { "field": "source.integration", "operator": "equals", "value": "github" }
  ] },
  "target": { "boardKey": "release" }
}'
```

- `GET` and `PUT /web/intake/label-routes` answer `410` with `label_routes_removed`. Stored label routes are no longer read.
- `PUT /web/intake/bindings` ignores `board`, and bindings no longer return it. A binding only decides which project a source feeds. Rebinding a source no longer moves its cards.
- `/web/gitlab/issues` no longer takes a `board` query parameter.
- A GitHub label change updates the card's labels and never moves the card.

**API changes for host rules**

- `intakeTarget(boards)` and `withIntakeTarget(boards)` from `@mastra/factory/boards` no longer take a `board` argument: they always name the default board's first phase, since intake routes place the card from there.
- `FactoryRuleIntakeTarget.pullRequestReview` is gone, so `context.intake.pullRequestReview` no longer compiles. In an `upsertLinkedWorkItem` decision, file a review request at `context.intake.board` / `context.intake.initialPhase` and let the `Requested reviews go to Review` route place it, or set `skipRules: true` with the stage you want.

```ts
// Before: file a review request straight into the review phase
stage: context.intake!.pullRequestReview ?? context.intake!.initialPhase,

// After: file it in the default board's first phase; the "Requested reviews go to Review" route moves it
board: context.intake!.board,
stage: context.intake!.initialPhase,
```

**Behavior changes**

- The board and stage an integration rule names no longer place a new card: every integration files new cards in the default board's first phase and the project's routes place them. A host override of `issueOpened` (or any intake rule) that picked a board or a phase such as `stage: 'pr-review'` is now routed like any other card. Add an intake route to get the same placement. `skipRules: true` still files a card exactly where the decision says.
- A pull request a maintainer asks Factory to review reaches Work › Review through the default `Pull requests go to Review` route. If you disabled that route, it now lands in Work › Intake.
- A Linear, Jira or incident.io source bound to a project without a board now feeds that project. Previously it was skipped until a board was picked. Unbind it if it should not feed the project.
- A binding's board used to send one source's cards to its own board. Routes can't always do the same: they see where an item lives, not which binding it came through. A `source.repository` condition matches a GitHub or GitLab repository, a Linear team or a Jira project, so sources that differ by one of those can still go to different boards. Two Linear projects in the same team share the team key, so a route can't send them to different boards; send that team to one board, or tell their items apart by another fact such as `item.labels`. incident.io items have no `source.repository`, so a `source.repository` condition never matches them; route them with `source.provider equals incidentio` or another fact.
