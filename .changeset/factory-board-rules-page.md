---
'mastra': minor
---

Added a Rules page to every Factory board. It replaces the board's Card moves page and the Factory-wide "Where new cards go" list in Settings, so everything that decides where a board's issues and pull requests go is in one place.

**Rules page**

Each event gets its own lane, grouped under Issues and Pull requests, such as "Issue opened", "Issue closed" or "Pull request merged". In each lane, rules are checked top to bottom and the first match wins. Lanes that can file an item with no card yet (issue or pull request opened, reopened, or labels or assignees changed) show where the board sits in the intake order; an item no rule here takes goes to the next board, and ends up in Not routed if no board takes it. Rules still stored on the old opened event show in the Issue opened lane, marked "Issue or pull request opened (legacy)". Rules are added and edited in a step-by-step dialog: pick the event, choose which items it applies to, then choose where they go. A card-move rule can send cards to another board: pick the board, then the phase. Condition filters include the pull request author's trust, and on label or assignee changes, which label or assignee was added or removed. Rules can be reordered, switched off or deleted. A rule that can never be reached, because a rule above it matches everything, is marked as such. A card-move rule that matched but couldn't move the card, for example because the target phase doesn't take cards, shows how often that happened in the last 30 days, with a link to the latest item. "Test an item" opens the intake tester, which shows where an issue or pull request would go and what every rule answered. Old `/moves` links now open the Rules page.

**Settings → Intake**

- **Intake order**: set the order in which boards are offered a new item. Drag rows or use the up and down buttons to try an order, then save or discard it. The page shows whether the order was worked out from your rules or saved, and how many recent cards would land on a different board than they do now.
- **Not routed**: a list of items no board took, loaded a page at a time. Click "Why?" to open the tester on an item and see what each rule answered. Once a rule takes it, click "Route again" to file it.

The board config page now sums this up in one line, for example "2 rules for new items · Checked 2nd", with a link to the board's rules. The "Send new cards to" control is removed.
