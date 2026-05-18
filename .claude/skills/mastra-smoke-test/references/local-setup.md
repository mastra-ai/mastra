# Local Development Setup

Instructions specific to `--env local` testing.

## Prerequisites

- Browser tools enabled via `/browser on`
- Works with either Stagehand (AI-powered) or AgentBrowser (deterministic) providers

If browser tools are not available, run `/browser` to configure.

## Environment Variables

Based on the selected LLM provider, ensure the API key is available:

| Provider  | Environment Variable           |
| --------- | ------------------------------ |
| openai    | `OPENAI_API_KEY`               |
| anthropic | `ANTHROPIC_API_KEY`            |
| groq      | `GROQ_API_KEY`                 |
| google    | `GOOGLE_GENERATIVE_AI_API_KEY` |
| cerebras  | `CEREBRAS_API_KEY`             |
| mistral   | `MISTRAL_API_KEY`              |

**Check order:**

1. Global environment: `echo $<ENV_VAR_NAME>`
2. Project `.env` file
3. Ask user only if not found

## Start Development Server

### 1. Check for a zombie on :4111 first

`mastra dev` auto-increments the port if `:4111` is already in use (e.g.
`:4112`, `:4113`). If you don't notice, your subsequent curls will hit the
**wrong** project (any earlier test session left running). Always check:

```bash
lsof -i :4111
# If a node process is listening, kill it before starting:
kill $(lsof -ti :4111) 2>/dev/null
```

### 2. Start

```bash
cd <project-directory>
<pm> run dev
```

Server starts on `http://localhost:4111`. Wait for "Mastra API running" in the
output and confirm the printed URL before running tests:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:4111/api/agents
# HTTP 200 → dev server up
```

**If the dev server prints `url: "http://localhost:4112/api"` instead of
`:4111`,** port 4111 was already taken. Stop, kill the zombie, and restart,
or pass `--port 4111` if supported — otherwise all the curl examples in the
test references will target the wrong server.

## Local Observability Setup

Verify observability is configured before testing traces:

### 1. Check `src/mastra/index.ts`

```typescript
import { createLogger } from '@mastra/core/logger';
import { OtelConfig } from '@mastra/core/telemetry';

export const mastra = new Mastra({
  // ... agents, tools, etc.
  logger: createLogger({ name: 'my-app', level: 'info' }),
  telemetry: new OtelConfig({
    serviceName: 'my-app',
    enabled: true,
  }),
});
```

### 2. Check Dependencies

Verify `package.json` includes:

- `@mastra/observability`

### 3. Check Dev Server Output

When starting the dev server, look for:

- "OpenTelemetry initialized" or similar success message
- Should NOT see "MASTRA_CLOUD_ACCESS_TOKEN not set" (that's for cloud only)

### Troubleshooting Local Traces

If traces are missing:

1. **Verify telemetry config** — Check `telemetry` is configured in Mastra instance
2. **Restart dev server** — Config changes require restart
3. **Check browser console** — Look for OTel export errors
4. **Check dependencies** — Ensure `@mastra/observability` is installed

## Testing Custom API Routes

After adding a custom route (see main SKILL.md):

```bash
curl http://localhost:4111/hello
# Expected: {"message":"Hello from custom route!"}
```

## Browser Agent Testing (Local)

When testing browser agents locally, you'll experience "browserception" — your MastraCode browser watching the project's agent browser.

Ensure Playwright browsers are installed:

```bash
<pm> exec playwright install chromium
```

## Notes

- Local traces are stored in-memory by default
- Traces persist only while the dev server is running
- For persistent traces, configure a storage backend
