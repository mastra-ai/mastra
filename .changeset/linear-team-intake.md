---
'@mastra/factory': minor
---

Added Linear team intake sources so Factory boards can ingest active projectless issues while preserving project precedence for overlapping selections.

Select a whole Linear team under Settings, Intake, or send the team source id directly. Team source ids come from `GET /web/linear/teams`; the Platform-backed integration issues opaque ids, the self-managed integration uses `linear-team:<teamId>`.

```ts
await fetch('/web/intake/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    linear: { enabled: true, sourceIds: ['linear-team:team-1', 'project-1'] },
  }),
});
```

A team source syncs active issues in the triage, backlog, unstarted, and started states, including issues without a project. When a project and its team are both selected, the project selection takes precedence for that project's issues.

Kept one live card per Linear issue across Factories: when an issue's winning source moves to a source routed to another Factory, the Factory that already holds the card keeps it instead of a second card being minted. The issue detail route keeps serving a card its Factory already holds after such a change, fetching through the selected sources only.
