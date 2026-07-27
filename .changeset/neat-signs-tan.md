---
'@mastra/factory': patch
---

Added an updateIssue capability to the Intake surface so Factory can change the state of external issues (open/closed on GitHub, workflow state on Linear) as a side effect of stage transitions. Adapters cover the direct GitHub, direct Linear, platform GitHub, and platform Linear integrations. GitHub adapters reject pull-request targets. Linear adapters resolve the target workflow state per team and skip when the issue is already in the desired state. The platform Linear adapter degrades to a no-op (returns null) when the platform workflow-states endpoint is not yet deployed, so this change is safe to ship ahead of the platform companion route. This is a plumbing change: no rule currently emits the new decision, so behavior is unchanged.
