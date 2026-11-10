---
'@mastra/factory': minor
---

**Intake routes can move cards into any phase.** A route that handles a status event (a close, a reopen, a pull request push or review request) now moves the card to its target phase even when that phase is a working phase such as Triage. One limit stays: on a board with a pull request loop, a pull request card enters only the review phase among working phases.

The move is not a person's go-ahead, so whether work starts follows the usual rules. A phase with `autoStart` (and a matching `autoStartWhen`) starts its run. So does any phase when the project's auto-run is on, and a re-review of a pull request Factory opened. Otherwise the run is proposed for a person to approve. With auto-run on, a reopen route into Triage therefore re-runs Triage straight away.

`allowWorkingPhase` is no longer used. Create and update requests still accept it for this release, but it is ignored, not stored, and no longer returned on routes. Clients that read it from route responses should stop:

```ts
// Before
if (route.allowWorkingPhase) {
  /* the route may move cards into a working phase */
}

// After: every route may. The target phase's `autoStart` (or the project's auto-run) decides whether its run starts.
const phase = board.phases.find(p => p.key === route.target.phaseKey);
const startsOnItsOwn = phase?.autoStart === true;
```

```bash
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes" -H 'content-type: application/json' -d '{
  "name": "Reopened bugs re-run Triage",
  "on": ["work_item.reopened"],
  "target": { "boardKey": "work", "phaseKey": "triage" }
}'
```
