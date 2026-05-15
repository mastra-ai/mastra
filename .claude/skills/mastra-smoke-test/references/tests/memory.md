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

## Curl / API (for `--skip-browser`)

The current `/agents/:agentId/generate` route expects thread/resource under a
`memory` object. Top-level `threadId` / `resourceId` are only read by the
deprecated `/generate-legacy` route — sending them to `/generate` silently
discards them and the agent will appear to "forget" context.

**Correct request shape:**

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "memory": { "thread": "<thread-id>", "resource": "<resource-id>" }
}
```

**Two-call persistence check:**

```bash
TID="smoke-memory-$(date +%s)"
RID="smoke-user"

# Call 1: seed context
curl -s -X POST "http://localhost:4111/api/agents/<agentKey>/generate" \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Remember: my name is Abhi.\"}],\"memory\":{\"thread\":\"$TID\",\"resource\":\"$RID\"}}"

# Call 2: same thread, verify recall
curl -s -X POST "http://localhost:4111/api/agents/<agentKey>/generate" \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"What is my name?\"}],\"memory\":{\"thread\":\"$TID\",\"resource\":\"$RID\"}}"

# Assert: thread exists in storage
curl -s "http://localhost:4111/api/memory/threads?resourceId=$RID" | \
  jq '{total, ids: (.threads | map(.id))}'
```

**Response shape:** `GET /api/memory/threads` returns
`{ threads: [...], total, page, perPage, hasMore }` — **not** a bare array.
Each entry has `{ id, resourceId, title, metadata, createdAt, updatedAt }`.

**Query params:** `resourceId` is **case-sensitive** (capital `I`). Lowercase
`resourceid` is silently ignored and returns **all** threads, which can make
a broken test look like it passed. `agentId` is optional.

**Pass criteria:**

- Call 2 response references "Abhi"
- `GET /api/memory/threads?resourceId=<rid>` returns `.total >= 1` with a
  thread whose `id` matches `$TID`
- To harden: seed a second thread under a different `resourceId` and
  confirm the filter excludes it

**If call 2 forgets context:** check you sent `memory: { thread, resource }`
(not top-level `threadId` / `resourceId`) and that `<agentKey>` matches the key
used in the `Mastra({ agents })` config, not the agent's `id` field.

**If `/memory/threads` returns threads from other resources:** you typed
`resourceid` instead of `resourceId` — the unknown param is dropped and no
filter is applied.
