---
'@mastra/factory': minor
---

Added boards you can build from Settings → Boards (or the API) for one Factory. A board is a list of phases (resting, working, or terminal) and where each can move next; cards start in the phase you choose. When a card enters a working phase, an agent starts in that phase's role with the card's details, and the phase's kickoff (a library skill or your own prompt) applies as it does on the built-in boards.

Boards belong to the Factory that created them: other Factories don't see them and can't put cards on them. A board can't be deleted while it still has cards, and an edit can't remove a phase that holds cards. The board catalog now marks these boards with `custom: true`.

```http
POST /web/factory/projects/:id/boards
{
  "title": "Ops",
  "initialPhase": "backlog",
  "phases": [
    { "id": "backlog", "title": "Backlog", "kind": "resting", "next": ["build"] },
    { "id": "build", "title": "Build", "kind": "working", "role": "work", "next": ["done"] },
    { "id": "done", "title": "Done", "kind": "terminal", "next": [] }
  ]
}
```
