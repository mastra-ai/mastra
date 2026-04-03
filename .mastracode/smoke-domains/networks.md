---
name: networks
description: Agent network mode coordination
---

# Networks

Requires a network agent to be configured (an agent with `agents` property and `memory`). The `/smoke-test` skill sets up a `planner-network` agent for this purpose.

## Routes

- `/agents/planner-network/chat` - Network agent chat view

## Tests

### Network agent is listed
1. Navigate to `/agents`
2. Verify the `planner-network` agent (or equivalent network agent) appears in the list
3. Screenshot

### Network mode can be selected
1. Navigate to `/agents/planner-network/chat`
2. Look for the Chat Method settings
3. Select "Network" mode
4. Verify the mode switches (UI should indicate network mode is active)
5. Screenshot

### Network coordination works
1. With Network mode selected, send a message: "What activities can I do in Tokyo based on the weather?"
2. Wait up to 60 seconds for the full network coordination to complete
3. Verify network coordination indicators appear (e.g., shows which sub-agent is being called)
4. Verify a final combined response appears
5. Screenshot

## Known Issues

- Network mode requires `memory` on the agent - if missing, it will error
- Network coordination can take longer than single-agent chat (30-60 seconds)
- The sub-agent indicators may flash quickly - screenshot timing matters
