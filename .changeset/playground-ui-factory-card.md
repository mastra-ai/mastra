---
'@mastra/playground-ui': minor
---

The Factory board card is now shared. `WorkItemCard`, its list and grid rows, menu items, relationship links and the card helpers behind them (stages, phases, rework reasons, card controls) are exported from `@mastra/playground-ui/domains/factory`. Hosts pass the card's repository as a prop and supply links through `BoardNavigationProvider`.
