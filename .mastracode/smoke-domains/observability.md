---
name: observability
description: Traces and timeline views
---

# Observability

Best tested AFTER running agent chats, tool executions, or workflows, since those generate the trace data that appears here.

## Routes

- `/observability` - Traces listing page

## Tests

### Traces listing loads
1. Navigate to `/observability`
2. Verify the traces list loads
3. If previous tests generated activity, verify at least one trace is shown
4. Screenshot

### Trace detail view
1. Click on a trace in the list to view its details
2. Verify the timeline view loads showing steps and timing
3. Verify individual spans/steps are visible with duration information
4. Screenshot

### Trace data is meaningful
1. In the trace detail view, verify that span names correspond to actual operations (e.g., agent calls, tool executions)
2. Verify timing data is present and reasonable (not zero or negative)
3. Screenshot

## Known Issues

- If no agents, tools, or workflows have been run yet, the traces list will be empty - this is expected
- Trace data may take a moment to appear after an operation completes
- Run the agents/tools/workflows domains first for best results
