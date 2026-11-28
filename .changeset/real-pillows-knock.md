---
'@mastra/playground-ui': minor
---

Removed domain components that Studio, Factory and Platform no longer render.

**Removed**

- `ViewGate` from `@mastra/playground-ui/domains/dashboards`.
- `MemoryDetailPanel` from `@mastra/playground-ui/domains/memory/components`: use `MemoryStudioPanel`, which it wrapped.
- `ObservationalMemoryDisplay` from `@mastra/playground-ui/domains/memory/components`.
- `DateRangeSelector` from `@mastra/playground-ui/domains/metrics/components`, deprecated earlier: use `MetricsTimeRangeChip`.
- `AgentConversationThreads`, `AgentConversationSidebar` and `AgentMemorySettings` from `@mastra/playground-ui/domains/agents/*`.
- `SubSectionHeader` from `@mastra/playground-ui/domains/prompt-blocks`: `SectionHeader` stays.
