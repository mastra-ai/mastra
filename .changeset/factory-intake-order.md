---
'@mastra/factory': minor
---

Added intake order: each board now owns its intake rules (up to 100 per board), and a project keeps a separate order in which its boards are asked to take a new item. Under the new evaluator an item no board's rules take is recorded as Not routed instead of landing on a default board, and an admin can route it again once a rule is fixed.

**Opting in**

The old evaluator stays the default while replicas upgrade. Turn the new one on with the `intake` option or `FACTORY_INTAKE_EVALUATOR=intake-order`, set the same on every replica:

```ts
const factory = new MastraFactory({
  intake: { evaluator: 'intake-order' },
});
```

**Before you switch**

Factory derives each project's intake order from its current rules and, in the background, compares both evaluators over the newest 200 items. Until you set the order yourself it follows your rule edits and is compared again after each. `GET /web/factory/projects/:id/intake-order` reports how many would land on a different board and how many no board would take, so you can fix rules first.

**Also new**

- `PUT /web/factory/projects/:id/intake-order` sets the order.
- `GET /web/factory/projects/:id/intake/not-routed` lists items no board took, oldest first, a page at a time (`limit`, `cursor`); `POST .../intake/not-routed/:decisionId/route-again` files one by intake order once a rule takes it.
- Intake rules can be listed and reordered per board with `boardKey`.
- Deleting a board deletes its intake rules, each audited.
- Under the new evaluator, a card created without a board that no board takes is refused with `intake_board_required` (the `factory_create_work_item` tool now accepts a `board` for this), and moving a rule to another board is refused with `intake_route_board_fixed`.
