---
'@mastra/playground-ui': patch
---

Fixed deep links for scorer, observability, and agent trace dialogs.

Developers can now share and reload URLs that keep the selected trace, scoring tab, span, and score in Studio.

**Before**
`/observability`
`/agents/chef-agent/traces`
`/evaluation/scorers/response-quality`

**After**
`/observability?traceId=...&spanId=...&tab=scores&scoreId=...`
`/agents/chef-agent/traces?traceId=...&spanId=...&tab=scores&scoreId=...`
`/evaluation/scorers/response-quality?entity=...&scoreId=...`

This makes review links reliable across the scorer page, observability, and the agent traces view.
