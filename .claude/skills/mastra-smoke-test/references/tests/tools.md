# Tools Testing (`--test tools`)

## Purpose

Verify tools page loads and tool execution works.

## Steps

### 1. Navigate to Tools Page

- [ ] Open `/tools` in Studio
- [ ] Note if tools list loads and any errors displayed
- [ ] Record which tools appear (e.g., "get-weather")

### 2. Select a Tool

- [ ] Click on a tool (e.g., `get-weather`)
- [ ] Note if tool details panel opens
- [ ] Record which input fields are visible

### 3. Execute Tool

- [ ] Enter test input (e.g., "London" for city field)
- [ ] Click "Submit" or "Run"
- [ ] Wait for execution

### 4. Observe Output

- [ ] Record the output format (JSON, text, etc.)
- [ ] Record the output content
- [ ] Note any error messages

### 5. Test Error Handling

- [ ] Enter invalid input (e.g., empty or special characters)
- [ ] Record the error message displayed
- [ ] Note if tool crashes or handles gracefully

## Observations to Report

| Check          | What to Record                     |
| -------------- | ---------------------------------- |
| Tools list     | Which tools appear, any errors     |
| Tool details   | Input fields shown                 |
| Execution      | Output format and content          |
| Output data    | Data returned                      |
| Error handling | Error message content and behavior |

## Common Issues

| Issue                | Cause                | Fix                               |
| -------------------- | -------------------- | --------------------------------- |
| "No tools found"     | Tools not registered | Check `src/mastra/tools/` exports |
| Tool execution fails | Missing dependencies | Check tool implementation         |
| Invalid JSON output  | Tool error           | Check server logs                 |

## Browser Actions

```
Navigate to: /tools
Click: First tool in list (e.g., get-weather)
Type in input field: "London"
Click: Submit button
Wait: For output
Verify: JSON output appears
```

## Curl / API (for `--skip-browser`)

**`<toolId>` is the tool's `.id` property, not the export name.** A
`weatherTool` export with `id: 'get-weather'` is addressed as
`/api/tools/get-weather/execute`, not `/api/tools/weatherTool/execute`.

**List tools:**

```bash
curl -s http://localhost:4111/api/tools
```

**Execute a tool:**

```bash
curl -s -X POST "http://localhost:4111/api/tools/<toolId>/execute" \
  -H "Content-Type: application/json" \
  -d '{"data":{"location":"San Francisco"}}'
```

Note the `data` wrapper — the tool's input schema fields go **inside** `data`,
not at the top level.

**Pass criteria:**

- `/api/tools` returns a JSON object keyed by tool id
- `/execute` with valid input returns HTTP 200 with the tool's result object
- `/execute` with invalid input returns HTTP 200 with
  `{ error: true, validationErrors: {...} }` (see `errors.md`)

**Common mistakes:**

- Using the export name (e.g. `weatherTool`) instead of the tool's `id`
  (e.g. `get-weather`) → 404 "Tool not found"
- Sending input fields at the top level instead of under `data` → validation
  error on every field
- External API failures surface as HTTP 500 with upstream error content.
  Retry with a different input (e.g. a well-known city) before concluding
  the tool itself is broken.
