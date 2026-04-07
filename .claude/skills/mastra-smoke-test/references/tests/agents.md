# Agents Testing (`--test agents`)

## Purpose
Verify agents page loads and agent chat functionality works.

## Steps

### 1. Navigate to Agents Page
- [ ] Open `/agents` in Studio
- [ ] Verify agents list loads without errors
- [ ] Confirm at least one agent appears (e.g., "Weather Agent")

### 2. Open Agent Chat
- [ ] Click on an agent (e.g., Weather Agent)
- [ ] Verify chat interface loads
- [ ] Confirm input field is visible

### 3. Send Test Message
- [ ] Enter: `What's the weather in Tokyo?`
- [ ] Click Send or press Enter
- [ ] Wait for response (may take 5-30 seconds)

### 4. Verify Response
- [ ] Agent responds with weather information
- [ ] Response is coherent and relevant
- [ ] No error messages displayed

### 5. Test Follow-up (Memory Check)
- [ ] Send: `What about London?`
- [ ] Verify agent understands context (comparing cities)
- [ ] Response references the previous question

## Expected Results

| Check | Expected |
|-------|----------|
| Agents list | Shows at least one agent |
| Chat loads | Input field visible, no errors |
| First message | Agent responds with weather data |
| Follow-up | Agent remembers previous context |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Failed to load agents" | Server not running | Start dev server / check deploy |
| Agent doesn't respond | Missing API key | Check `.env` has LLM API key |
| Timeout | Slow LLM response | Wait longer, check network |

## Browser Actions

```
Navigate to: /agents
Click: First agent in list
Type in chat: "What's the weather in Tokyo?"
Click: Send button
Wait: For response
Type in chat: "What about London?"
Click: Send button
Wait: For response
```
