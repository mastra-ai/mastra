---
'@mastra/playground-ui': minor
---

Redesign workflow cards with colored type badges, inset content surfaces, execution timing, and a shared activity edge. Conditions display their supplied expressions inline with copy support and unformatted-source fallbacks. Nested graphs expand inside dashed groups, while parallel paths retain a shared input-data control and distinct branch outputs.

Keep the canvas camera stable during execution and expansion. Position zoom controls above the graph with a 10–400% range, and anchor connectors to measured node bounds inside nested canvases.

Workflow condition views no longer take disclosure or dialog state. Removed the unused `WorkflowConditionCode`, `WorkflowConditionDialog`, `WorkflowCardBadges`, and `WorkflowCardStatusIcon` exports; use `WorkflowConditionCard`, `WorkflowTypeBadge`, and the step card's status presentation instead.
