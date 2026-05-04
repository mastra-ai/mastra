# Cloud Advanced Testing

Advanced test flows for `--env staging` and `--env production`.

> **Note**: For account creation, team invites, and RBAC testing, use the `platform-smoke-test` skill.
> Those features are part of the platform dashboard (`projects.mastra.ai` / `gateway.mastra.ai`), not deployed Studio/Server projects.

## BYOK Testing (`--byok`)

Tests bring-your-own-key functionality for **deployed servers**.

This tests passing your own API key to your deployed Mastra server (not the Gateway API).

### Via HTTP Header

```bash
# Test with OpenAI key via header
curl -X POST https://<project>.server.mastra.cloud/api/agents/weather-agent/generate \
  -H "Content-Type: application/json" \
  -H "x-openai-api-key: sk-your-openai-key" \
  -d '{"messages": [{"role": "user", "content": "What is the weather in Tokyo?"}]}'

# For staging environment
curl -X POST https://<project>.server.staging.mastra.cloud/api/agents/weather-agent/generate \
  -H "Content-Type: application/json" \
  -H "x-openai-api-key: sk-your-openai-key" \
  -d '{"messages": [{"role": "user", "content": "What is the weather in Tokyo?"}]}'
```

Supported headers:

- `x-openai-api-key` - OpenAI
- `x-anthropic-api-key` - Anthropic
- `x-google-api-key` - Google

### Via Project Settings

1. Navigate to deployed Studio → Settings → API Keys
2. Add OpenAI/Anthropic/Google API key
3. Verify agents use the configured key instead of default

## Storage Backend Testing (`--db`)

Tests that the project works with the selected database backend.

### LibSQL (Default)

```bash
# No additional setup required
# Uses local SQLite file in development
```

### PostgreSQL (`--db pg`)

Requires `DATABASE_URL` environment variable:

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db"
```

### Turso (`--db turso`)

Requires Turso credentials:

```bash
export TURSO_DATABASE_URL="libsql://your-db.turso.io"
export TURSO_AUTH_TOKEN="your-token"
```

## Extended Test Verification Checklist

| Category    | Test          | Expected Result                      | Status |
| ----------- | ------------- | ------------------------------------ | ------ |
| **BYOK**    | Header key    | Agent uses key from header           | ⬜     |
| **BYOK**    | Settings key  | Agent uses key from project settings | ⬜     |
| **Storage** | DB connector  | Project works with selected DB       | ⬜     |
| **Storage** | Data persists | Data survives server restart         | ⬜     |
