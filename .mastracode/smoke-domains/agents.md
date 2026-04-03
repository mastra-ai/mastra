---
name: agents
description: Agent listing, detail views, and chat
---

# Agents

## Routes

- `/agents` - Agent listing page
- `/agents/<agentId>/chat` - Agent detail and chat view

## Tests

### Agent listing loads
1. Navigate to `/agents`
2. Verify at least one agent is listed (the example weather agent)
3. Screenshot

### Agent detail view loads
1. Click on an agent to view its details
2. Verify the agent overview panel loads with agent name and description
3. Verify model settings panel is visible
4. Screenshot

### Agent chat works
1. From the agent detail view, locate the chat input
2. Send a test message: "Hello, can you help me?"
3. Wait up to 30 seconds for a response
4. Verify a response appears in the chat thread
5. Screenshot the conversation

### Agent chat handles follow-up
1. Send a follow-up message: "What can you do?"
2. Wait up to 30 seconds for a response
3. Verify the response appears below the first exchange
4. Screenshot

## Known Issues

- First message after server start may be slower due to cold start
- If the API key is invalid, the chat will show an error - this is expected behavior, not a bug
