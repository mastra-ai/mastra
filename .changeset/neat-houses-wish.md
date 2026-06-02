---
'@internal/playground': patch
---

Fix stale workflow graph when navigating between workflow runs in Studio. React Router reuses the WorkflowLayout/Workflow component instances when navigating between two routes that match the same /workflows/:workflowId/graph/:runId pattern, so component-local state from useNodesState/useEdgesState in the graph and from result/payload in WorkflowRunProvider held data from the previously viewed run. The graph now keys ReactFlowProvider on workflowId+runId to force a fresh re-init, and WorkflowRunProvider resets result/payload when either route param changes.
