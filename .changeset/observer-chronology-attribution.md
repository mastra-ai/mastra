---
'@mastra/memory': patch
---

Observational memory now keeps observations in the order events happened. Before, the Observer could list an important user message ahead of earlier events from the same period, so an outdated state looked like the latest one. For example, a plan-approval tool's "plan not approved, wait for revision instructions" was recorded after the user's actual revision instructions, and the agent kept waiting for instructions it already had. Tool calls and results in the Observer's input now always show their time, and the observation format asks for chronological order within each date rather than order of importance.
