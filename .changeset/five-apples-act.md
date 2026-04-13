---
'@mastra/playground-ui': patch
---

Added `PageLayout` and `PageHeader` compound components for consistent page structure across Mastra Studio, plus a `NoDataPageLayout` helper for 401/403/empty/error states.

List components (`AgentsList`, `WorkflowsList`, `ToolsList`, `ProcessorsList`, `McpServersList`, `PromptsList`, `LogsList`, `ObservabilityTracesList`) no longer handle errors or empty states internally — handle those at the page level. If you consume these components directly, move error/empty-state rendering to the parent.
