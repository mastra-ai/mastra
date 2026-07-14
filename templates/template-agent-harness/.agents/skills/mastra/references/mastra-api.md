# Mastra API CLI Reference

How to use the `mastra api` CLI to interact with Mastra servers. Prefer fast, focused commands and compact JSON projections. Treat the installed CLI and server schema as the source of truth when discovery is needed.

Use this reference when the user asks to inspect or call agents, workflows, tools, MCP servers, memory threads, traces, logs, metrics, scores, datasets, experiments, or to debug/test `mastra api` commands.

## Setup

The CLI can interact with any reachable Mastra server:

- Local dev server: `http://localhost:4111` from `npm run dev`
- Mastra platform deployment: Use the deployment URL
- Remote/self-hosted server: Use the server URL
- Hosted Mastra Platform Observability: `https://observability.mastra.ai` (auto-targeted by `trace`, `log`, `score`, and `metric` commands)

For local servers, `mastra api` defaults to `http://localhost:4111`:

```bash
npx mastra api agent list
```

For Mastra platform or remote servers, pass `--url`. For the sake of brevity in examples, `$MASTRA_URL` is used as a placeholder for the actual server URL which you need to set yourself:

```bash
npx mastra api --url $MASTRA_URL agent list
```

Verify the server once with a cheap check before resource calls:

```bash
MASTRA_URL="${MASTRA_URL:-http://localhost:4111}"
curl -fsS "$MASTRA_URL/api/system/api-schema" >/dev/null
```

If `$MASTRA_URL` is not reachable, the user may be using a Mastra platform deployment or remote URL. Ask for the correct server URL and set `--url` accordingly. If authentication is required, ask the user for the necessary token or credentials and set them in the environment for subsequent commands.

For authenticated servers, pass repeatable headers:

```bash
npx mastra api --url "$MASTRA_URL" --header "Authorization: Bearer $TOKEN" agent list
```

### Target resolution

Runtime commands (`agent`, `workflow`, `tool`, `mcp`, `thread`, `memory`, `dataset`, `experiment`) resolve the target in this order:

1. `--url <url>` for an explicit remote or self-hosted server.
2. `http://localhost:4111` for a local `mastra dev` server.
3. `.mastra-project.json` for a Mastra platform project.

Observability commands (`trace`, `log`, `score`, `metric`) target `https://observability.mastra.ai` by default instead of a project deployment URL. The CLI resolves credentials in this order:

1. Explicit `Authorization` and `X-Mastra-Project-Id` headers passed with `--header`.
2. `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PROJECT_ID` from the environment.
3. Project metadata from `.mastra-project.json` for the project ID.
4. The Mastra CLI login token as an auth fallback.

For observability calls, no `--url` or `--header` is required if `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PROJECT_ID` are set, or if `.mastra-project.json` is present:

```bash
npx mastra api trace list '{"page":0,"perPage":10}'
npx mastra api metric names
```

Pass `--url` and `--header` only when overriding the hosted observability target or credentials.

## Decision flow

1. Clear read-only request (`list X`, `latest X`, `get X`, `summarize recent X`): infer the resource and use the fast path first.
2. Mutating request (`create`, `update`, `delete`, `run`, `resume`, `execute`), unclear resource/action, failed fast path, or exact syntax requested: use narrow CLI discovery.
3. JSON input uncertain: use command-specific `--schema`.
4. Route behavior confusing: inspect `/api/system/api-schema`.

Start with these command groups when present; verify with `mastra api --help` if the group fails.

```text
agent workflow tool mcp thread memory trace log metric score dataset experiment
```

## Fast path for read-only requests

Use conventional `list`/`get` commands first. Keep pages small and pipe through `jq` immediately.

Latest item:

```bash
npx mastra api <resource> list '{"page":0,"perPage":1}' \
  | jq '.data[0]'
```

Recent items:

```bash
npx mastra api <resource> list '{"page":0,"perPage":10}' \
  | jq '.data[]'
```

When the shape is known, project only the fields needed for the task:

```bash
npx mastra api <resource> list '{"page":0,"perPage":10}' \
  | jq '.data[] | {id, name, createdAt, status}'
```

Get details:

```bash
npx mastra api <resource> get <id> \
  | jq '.data'
```

When the shape is known, project only the fields needed for the task:

```bash
npx mastra api <resource> get <id> \
  | jq '.data | {id, name, createdAt, status}'
```

If a resource does not support the conventional shape, fall back to narrow `--help` for that resource/action.

## Output control

- Do not use unfiltered `--pretty` during exploration.
- Always project list/get output with `jq` before reading details.
- Use `perPage:1` for latest and `perPage:10` or less for recent lists.
- If output is truncated or noisy, rerun with a narrower `jq` projection. Do not increase terminal output just to see more raw JSON.
- Fetch full JSON only when the user asks for raw output or compact projections are insufficient.

## Fallback discovery

Use the narrowest discovery command that can answer the question. Example for traces:

```bash
npx mastra api trace --help
npx mastra api trace list --help
npx mastra api trace list --schema
```

Use top-level help only when the resource is unknown:

```bash
npx mastra api --help
```

Read `--schema` output as the contract:

- `command`: usage string
- `examples`: known-good examples
- `positionals`: required path/identity arguments
- `input.required`: whether JSON input is required
- `input.schema`: accepted CLI JSON input, including query/body fields
- `schemas`: raw server route schemas for deeper debugging

## JSON and output contract

`mastra api` accepts at most one inline JSON object as input. Do not use stdin or files unless the user explicitly asks.

For non-GET routes, the CLI splits the one JSON object into query parameters and request body according to the server route schema.

Output envelopes:

```json
{ "data": {} }
{ "data": [], "page": { "total": 0, "page": 0, "perPage": 0, "hasMore": false } }
{ "error": { "code": "...", "message": "...", "details": {} } }
```

## Error handling

- `INVALID_JSON`: fix shell quoting; input must be one JSON object.
- `MISSING_INPUT`: run the same command with `--schema` and supply required JSON.
- `MISSING_ARGUMENT`: provide the positional shown by `--help` / `--schema`.
- `HTTP_ERROR`: inspect `error.details`, then compare against `--schema` or route schema.
- `REQUEST_TIMEOUT`: retry with larger `--timeout`, especially for workflow execution.
- `SERVER_UNREACHABLE`: verify the URL and the server check. If localhost is not running, ask whether the user wants to use a Mastra platform deployment or another remote server URL.

## Route-level debugging

If CLI behavior seems wrong, inspect the route-derived schema manifest instead of guessing.

Find routes by path:

```bash
curl -fsS "$MASTRA_URL/api/system/api-schema" \
  | jq '.routes[] | select(.path | contains("/memory"))'
```

Inspect one route:

```bash
curl -fsS "$MASTRA_URL/api/system/api-schema" \
  | jq '.routes[] | select(.method == "POST" and .path == "/tools/:toolId/execute") | {pathParamSchema, queryParamSchema, bodySchema, responseShape}'
```

## Known notes

- Tool and MCP tool execution accept raw tool input; explicit `{ "data": ... }` also works.
- Workflow resume only works for suspended workflow runs.
- Working memory update requires the agent's memory to have working memory enabled.
- Empty lists may simply mean the server has no matching stored data yet.
- `trace list` and `trace get` return lightweight payloads by default (no span input, output, attributes, or metadata). Pass `--verbose` to fetch full span records, or use `trace span <traceId> <spanId>` to fetch one specific span in full.
