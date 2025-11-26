---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Fix network data step formatting in AI SDK stream transformation

Previously, network execution steps were not being tracked correctly in the AI SDK stream transformation. Steps were being duplicated rather than updated, and critical metadata like step IDs, iterations, and task information was missing or incorrectly structured.

**Changes:**

- Enhanced step tracking in `AgentNetworkToAISDKTransformer` to properly maintain step state throughout execution lifecycle
- Steps are now identified by unique IDs and updated in place rather than creating duplicates
- Added proper iteration and task metadata to each step in the network execution flow
- Fixed agent, workflow, and tool execution events to correctly populate step data
- Updated network stream event types to include `networkId`, `workflowId`, and consistent `runId` tracking
- Added test coverage for network custom data chunks with comprehensive validation

This ensures the AI SDK correctly represents the full execution flow of agent networks with accurate step sequencing and metadata.
