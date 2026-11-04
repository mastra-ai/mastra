---
'@mastra/factory': minor
---

Added board events to intake routes. You can now decide what happens to an existing card when its issue closes or reopens, and the session working a card now hears about new comments and edits.

**Routes handle status events.** A route names the events it handles in `on`: `work_item.created` (the default, where a new card lands), `work_item.closed` and `work_item.reopened`. Close and reopen routes can test `event.type` and `event.reason` (`completed` or `canceled`). When a route matches, the card moves to its phase as a system move. The move is recorded in the card's history and audit log, waits for a run in flight (except into a terminal phase), and skips the board's `nextPhases`, so a reopened card can leave Done. A move into a working phase such as Triage needs `allowWorkingPhase: true` on the route. A move into a terminal phase aborts a session still running on the card at once, as closes always have. A route move clears the card's armed autonomy, so a reopened card waits for a person or auto-run before it works again.

```bash
# Send every reopened issue back to Triage, to run again, instead of Intake.
curl -X PATCH "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes/$REOPENED_ROUTE" -H 'content-type: application/json' -d '{
  "target": { "boardKey": "work", "phaseKey": "triage" },
  "allowWorkingPhase": true,
  "expectedRevision": 1
}'
```

**Closes are editable default routes.** Every project gets three new default routes, added once: `Closed issues go to Done`, `Issues closed as not planned go to Canceled` and `Reopened issues go back to Intake`. GitHub, GitLab, Linear, Jira and incident.io closes land where they did before, but you can now edit, disable or delete the move. A deleted default is not added back. Disabling both close routes leaves closed Work cards where they are. A board with no route for an event still uses its `sourceClosed` mapping, so custom boards keep closing as before.

**Comments and edits reach the card's session.** A new comment on a card's GitHub or GitLab issue, or an edit to its title or description, sends the card's session a short message such as `New comment by @alice on acme/repo#42: <link>`. The message never includes the comment's text or the issue's title. Authors without write access are marked `(untrusted author)`. An idle session wakes up for GitHub activity from trusted authors only; untrusted activity and GitLab activity waits for the session's next run. Comments that arrive while the session is busy are combined into one notification. Cards nobody is working ignore them, and Triage still runs only once.

**Behavior changes**

- The stock close handlers still return the board's `sourceClosed` move, now tagged with the close event. Routes on the card's board replace that move when a route there names `work_item.closed`, even a disabled one. Custom overrides that return their own move are unaffected.
- An explicit handler or `null` for an event in an integration's `rules`, or `null` on a board's handlers, keeps routes and activity messages out of that event entirely.
- GitLab reopens now arrive as their own `issueReopened` event. A custom `issueOpened` override no longer sees reopens. Override `issueReopened` to handle them.
- GitHub `issues` webhooks with action `reopened` now reach rules as `issueReopened`.
- Factory can't yet tell its own GitLab comments apart from other people's, so GitLab activity never wakes an idle session; it waits for the session's next run.
