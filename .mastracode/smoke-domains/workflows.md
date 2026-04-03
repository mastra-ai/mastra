---
name: workflows
description: Workflow listing, graph view, and execution
---

# Workflows

## Routes

- `/workflows` - Workflow listing page
- `/workflows/<workflowName>` - Workflow detail and execution view

## Tests

### Workflow listing loads
1. Navigate to `/workflows`
2. Verify the workflows list loads with at least one workflow (should show `weatherWorkflow`)
3. Screenshot

### Workflow detail and graph view
1. Click on `weatherWorkflow` to open its detail page
2. Verify the visual graph displays showing workflow steps
3. Verify step nodes are visible and connected
4. Screenshot

### Workflow execution works
1. On the workflow detail page, find the city input field
2. Enter "London" as the input value
3. Click the Run button
4. Wait up to 30 seconds for execution to complete
5. Verify workflow steps show success indicators (green checkmarks or similar)
6. Screenshot

### Workflow output is viewable
1. After successful execution, click to view the JSON output modal/panel
2. Verify execution details with timing information appear
3. Verify the output contains weather-related data
4. Screenshot

## Known Issues

- Workflow graph rendering can take a moment after page load
- Long-running workflows may need extra wait time
- The output modal may need to be scrolled to see all data
