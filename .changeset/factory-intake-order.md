---
'@mastra/factory': minor
---

Added intake order: each board now owns its intake rules (up to 100 per board), and a project keeps a separate order in which its boards are asked to take a new item. Under the new evaluator an item no board's rules take is recorded as Not routed instead of landing on a default board, and an admin can route it again once a rule is fixed.

**Which projects use it**

Projects created from this release on use the new evaluator. Existing projects keep the old one until an admin switches them:

```sh
mastra api factory intake-order set <project-id> '{"evaluator":"intake-order"}'
```

To force one evaluator on every project (for a rollout or tests), set the `intake` option or `FACTORY_INTAKE_EVALUATOR` (`intake-order` or `route-list`) the same on every replica:

```ts
const factory = new MastraFactory({
  intake: { evaluator: 'intake-order' },
});
```

A project falls back to the old evaluator only when its setting was read and is empty; while it can't be read, arrivals wait and retry and a card created without a board is refused with `intake_board_required`.

During a rolling deploy, replicas still on an older release decide every project by the old evaluator, so a new project's items can be routed that way until all replicas run this release.

**Before you switch**

Factory derives each project's intake order from its current rules, and follows your rule edits until you set the order yourself. `GET /web/factory/projects/:id/intake-order` runs both evaluators over the newest 200 items against the order in force and reports how many would land on a different board and how many no board would take, so you can fix rules first.

**Also new**

- `PUT /web/factory/projects/:id/intake-order` sets the order, the project's evaluator, or both; `GET` reports the evaluator in use and where it came from (`evaluatorSource`).
- `GET /web/factory/projects/:id/intake/not-routed` lists items no board took, oldest first, a page at a time (`limit`, `cursor`); `POST .../intake/not-routed/:decisionId/route-again` files one by intake order once a rule takes it.
- Intake rules can be listed and reordered per board with `boardKey`.
- Deleting a board deletes its intake rules, each audited.
- Under the new evaluator, a card created without a board that no board takes is refused with `intake_board_required` (the `factory_create_work_item` tool now accepts a `board` for this), and moving a rule to another board is refused with `intake_route_board_fixed`.
