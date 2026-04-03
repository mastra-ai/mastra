---
name: tools
description: Tool listing and execution
---

# Tools

## Routes

- `/tools` - Tool listing page
- `/tools/<toolName>` - Tool detail and execution view

## Tests

### Tool listing loads
1. Navigate to `/tools`
2. Verify the tools list loads with at least one tool (should show `weatherTool`)
3. Screenshot

### Tool detail view loads
1. Click on `weatherTool` to open its detail page
2. Verify the tool name and description are visible
3. Verify an input form is displayed with the expected fields
4. Screenshot

### Tool execution works
1. On the `weatherTool` detail page, find the city input field
2. Enter "Tokyo" as the city value
3. Click the Submit button
4. Wait up to 15 seconds for execution to complete
5. Verify JSON output appears with weather data (should contain temperature, condition, or similar fields)
6. Screenshot the result

### Tool handles different inputs
1. Clear the previous input
2. Enter "London" as the city value
3. Click Submit
4. Wait for execution to complete
5. Verify new JSON output appears (different from the Tokyo result)
6. Screenshot

## Known Issues

- Tool execution depends on the tool's implementation - the example weatherTool returns mock data
- If the tool has required fields that aren't filled, submission should show validation errors
