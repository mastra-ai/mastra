---
'@mastra/factory': minor
'mastra': patch
---

Added a dry run and a "Where would this go?" tester for intake rules. A rule that never fires because an earlier board takes everything it would match now shows up with evidence, before it files anything.

**Dry run**

`POST /web/factory/projects/:id/intake/dry-run` runs the intake rules over the project's newest 200 items, from what Factory already stored about them, and reports per board and per rule what it would take, what it would lose to an earlier board, and how many cards it actually filed in the last 30 days. Pass unsaved `boards` rules or an unsaved `order` to preview an edit: the response also says how many items would land somewhere else.

**Tester**

`POST /web/factory/projects/:id/intake/test` takes one item, by `url` or by the `itemId` of a recent card or Not routed item, and shows which board takes it and what every rule answered, including the condition each rule failed on and the item's value. A URL Factory hasn't seen is read once from a GitHub repository or GitLab project linked to the project; others are refused with `not_linked`.

Neither request files a card, records a decision or writes to a provider. Both run the intake order evaluator's own code, so they answer exactly what filing under intake order would.
