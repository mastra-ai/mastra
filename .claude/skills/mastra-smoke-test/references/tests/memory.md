# Memory Testing (`--test memory`)

## Purpose
Verify conversation memory persists and context is maintained.

## Prerequisites
- Agent with memory configured
- Completed at least one agent chat

## Steps

### 1. Start Fresh Conversation
- [ ] Navigate to `/agents`
- [ ] Select an agent (e.g., Weather Agent)
- [ ] Send: `What's the weather in Tokyo?`
- [ ] Wait for response

### 2. Test Context Retention
- [ ] Send follow-up: `What about comparing it to London?`
- [ ] Verify agent references Tokyo in response
- [ ] Agent should understand "it" refers to weather

### 3. Test Navigation Persistence
- [ ] Navigate away (e.g., to `/tools`)
- [ ] Navigate back to `/agents` → same agent
- [ ] Verify conversation history is visible
- [ ] Previous messages should be displayed

### 4. Test Cross-Session (if applicable)
- [ ] Note the current thread/conversation
- [ ] Refresh the page (F5)
- [ ] Navigate back to the same agent
- [ ] Verify history persists (depends on memory config)

### 5. Test New Thread
- [ ] Start a new conversation (if UI supports)
- [ ] Verify new thread has no history
- [ ] Old thread should still be accessible

## Expected Results

| Check | Expected |
|-------|----------|
| Context retention | Agent remembers previous messages |
| Navigation | History visible after navigating away |
| Page refresh | History persists (if memory configured) |
| New thread | Fresh conversation possible |

## Memory Configurations

| Type | Persistence | Configuration |
|------|-------------|---------------|
| In-memory | Session only | Default |
| LibSQL | Persistent | `@mastra/libsql` storage |
| PostgreSQL | Persistent | `@mastra/pg` storage |
| Turso | Persistent | `@mastra/turso` storage |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| No history after refresh | In-memory storage | Configure persistent storage |
| Agent forgets context | Memory not configured | Add `memory` to agent config |
| Thread not found | Invalid thread ID | Start new conversation |

## Browser Actions

```
Navigate to: /agents
Click: Select agent
Type: "What's the weather in Tokyo?"
Send: Message
Wait: For response
Type: "What about comparing it to London?"
Send: Message
Verify: Response references Tokyo

Navigate to: /tools
Navigate to: /agents
Click: Same agent
Verify: Previous messages visible

Refresh: Page (F5)
Navigate to: /agents
Click: Same agent
Verify: History still visible (if persistent storage)
```
