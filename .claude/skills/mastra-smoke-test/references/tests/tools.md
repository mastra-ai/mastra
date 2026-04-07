# Tools Testing (`--test tools`)

## Purpose
Verify tools page loads and tool execution works.

## Steps

### 1. Navigate to Tools Page
- [ ] Open `/tools` in Studio
- [ ] Verify tools list loads without errors
- [ ] Confirm at least one tool appears (e.g., "get-weather")

### 2. Select a Tool
- [ ] Click on a tool (e.g., `get-weather`)
- [ ] Verify tool details panel opens
- [ ] Confirm input fields are visible

### 3. Execute Tool
- [ ] Enter test input (e.g., "London" for city field)
- [ ] Click "Submit" or "Run"
- [ ] Wait for execution

### 4. Verify Output
- [ ] Tool returns JSON output
- [ ] Output contains expected data (weather info)
- [ ] No error messages

### 5. Test Error Handling
- [ ] Enter invalid input (e.g., empty or special characters)
- [ ] Verify user-friendly error message
- [ ] Tool doesn't crash

## Expected Results

| Check | Expected |
|-------|----------|
| Tools list | Shows available tools |
| Tool details | Input fields visible |
| Execution | Returns JSON output |
| Output data | Contains relevant data |
| Error handling | Friendly error on bad input |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "No tools found" | Tools not registered | Check `src/mastra/tools/` exports |
| Tool execution fails | Missing dependencies | Check tool implementation |
| Invalid JSON output | Tool error | Check server logs |

## Browser Actions

```
Navigate to: /tools
Click: First tool in list (e.g., get-weather)
Type in input field: "London"
Click: Submit button
Wait: For output
Verify: JSON output appears
```
