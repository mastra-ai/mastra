# Agents Testing (`--test agents`)

## Purpose

Verify agents page loads and agent chat functionality works.

## Steps

### 1. Navigate to Agents Page

- [ ] Open `/agents` in Studio
- [ ] Note if agents list loads and any errors displayed
- [ ] Record which agents appear (e.g., "Weather Agent")

### 2. Open Agent Chat

- [ ] Click on an agent (e.g., Weather Agent)
- [ ] Note if chat interface loads
- [ ] Record whether input field is visible

### 3. Send Test Message

- [ ] Enter: `What's the weather in Tokyo?`
- [ ] Click Send or press Enter
- [ ] Wait for response (may take 5-30 seconds)

### 4. Observe Response

- [ ] Record the agent's response content
- [ ] Note if response is coherent and relevant
- [ ] Record any error messages displayed

### 5. Test Follow-up (Memory Check)

- [ ] Send: `What about London?`
- [ ] Note if agent references the previous question
- [ ] Record whether context appears to be maintained

## Observations to Report

| Check         | What to Record                            |
| ------------- | ----------------------------------------- |
| Agents list   | Number of agents shown, any errors        |
| Chat loads    | Whether input field appears, any errors   |
| First message | Agent response content and relevance      |
| Follow-up     | Whether agent references previous context |

## Common Issues

| Issue                   | Cause              | Fix                             |
| ----------------------- | ------------------ | ------------------------------- |
| "Failed to load agents" | Server not running | Start dev server / check deploy |
| Agent doesn't respond   | Missing API key    | Check `.env` has LLM API key    |
| Timeout                 | Slow LLM response  | Wait longer, check network      |

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

## Curl / API (for `--skip-browser`)

**`<agentKey>` is the key used in `Mastra({ agents: { weatherAgent } })`, not
the agent's `id` field.** A template where `agents: { weatherAgent }` and the
agent's `id: 'weather-agent'` is addressed as `/api/agents/weatherAgent/...`,
not `/api/agents/weather-agent/...`.

**List agents:**

```bash
curl -s http://localhost:4111/api/agents
```

**Generate (single call, no memory):**

```bash
curl -s -X POST "http://localhost:4111/api/agents/<agentKey>/generate" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is the weather in Tokyo?"}]}'
```

**Generate with memory** (see `memory.md` for the two-call persistence check):

```bash
curl -s -X POST "http://localhost:4111/api/agents/<agentKey>/generate" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"..."}],"memory":{"thread":"<tid>","resource":"<rid>"}}'
```

**Pass criteria:**

- `/api/agents` returns a JSON object keyed by agent key
- `/generate` returns HTTP 200 with a `text` field containing a coherent
  response (and, if the agent has a tool, `toolCalls` / `toolResults` in
  `steps`)

**Common mistake:** sending `threadId` / `resourceId` at the top level to
`/generate` — these are silently discarded. Use `memory: { thread, resource }`.
Top-level `threadId` / `resourceId` are only read by the deprecated
`/generate-legacy` route.
