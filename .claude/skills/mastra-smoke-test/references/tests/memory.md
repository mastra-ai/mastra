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
- [ ] Wait for response and record it

### 2. Test Context Retention

- [ ] Send follow-up: `What about comparing it to London?`
- [ ] Note if agent references Tokyo in response
- [ ] Record whether agent understands "it" refers to weather

### 3. Test Navigation Persistence

- [ ] Navigate away (e.g., to `/tools`)
- [ ] Navigate back to `/agents` → same agent
- [ ] Note if conversation history is visible
- [ ] Record which previous messages are displayed

### 4. Test Cross-Session (if applicable)

- [ ] Note the current thread/conversation
- [ ] Refresh the page (F5)
- [ ] Navigate back to the same agent
- [ ] Record whether history persists

### 5. Test New Thread

- [ ] Start a new conversation (if UI supports)
- [ ] Note if new thread has no history
- [ ] Record whether old thread is still accessible

## Observations to Report

| Check             | What to Record                             |
| ----------------- | ------------------------------------------ |
| Context retention | Whether agent references previous messages |
| Navigation        | History visibility after navigating away   |
| Page refresh      | Whether history persists                   |
| New thread        | Behavior when starting fresh conversation  |

## Memory Configurations

| Type       | Persistence  | Configuration            |
| ---------- | ------------ | ------------------------ |
| In-memory  | Session only | Default                  |
| LibSQL     | Persistent   | `@mastra/libsql` storage |
| PostgreSQL | Persistent   | `@mastra/pg` storage     |
| Turso      | Persistent   | `@mastra/turso` storage  |

## Common Issues

| Issue                    | Cause                 | Fix                          |
| ------------------------ | --------------------- | ---------------------------- |
| No history after refresh | In-memory storage     | Configure persistent storage |
| Agent forgets context    | Memory not configured | Add `memory` to agent config |
| Thread not found         | Invalid thread ID     | Start new conversation       |

## Browser Actions

```text
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
