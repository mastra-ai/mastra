# Architecture and deployment

The browser displays verified results and sends user intent. Mastra owns analysis, source access,
conversation memory, workspace persistence, and observability. Next.js serves the UI and proxies
requests to Mastra; it does not open the analytical database or create agents.

## Reading the template

Start with [`src/mastra/index.ts`](../src/mastra/index.ts). It creates the Mastra instance,
connects the workspace and HTTP server, and registers shutdown cleanup.

| Module                        | Responsibility                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `src/mastra/configuration.ts` | Explicit source, enabled catalog, model, and storage paths                         |
| `src/mastra/lifecycle.ts`     | Trace storage, observability, and process shutdown                                 |
| `src/workspace/create.ts`     | Open the source, memory, and durable workspace                                     |
| `src/mastra/agent.ts`         | Mastra agent instructions and analytical/composition tools                         |
| `src/analysis/`               | Analytical workflow, verified results, and composition validation                  |
| `src/workspace/`              | Saved sessions, accepted revisions, actions, and guarded AG-UI runtime             |
| `src/components/`             | Browser-safe catalog contracts and data formatting shared with the server          |
| `src/server/`                 | Deployment settings, bounded request reading, and Next.js proxy                    |
| `app/`                        | Next.js page, layout, and thin API route handlers                                  |
| `src/ui/`                     | Client session loading, CopilotKit conversation slots, result cards, and renderers |
| `src/ui/charts/`              | ECharts lifecycle, Cartesian options, heatmap options, and cohort selection        |
| `scripts/`                    | Data preparation, builds, diagnostics, and live benchmark operations               |
| `tests/`                      | Test configurations, deterministic providers, fixtures, and checks                 |

The component catalog contains schemas and declarations, with no storage or Node-only APIs.
`src/analysis/composition.ts` checks agent selections against verified results on the server.
`src/workspace/contracts.ts` defines the snapshot schema used by the browser and server.
React renderers read that accepted snapshot; their callbacks request server-validated actions.

## Official CopilotKit integration

The [Mastra integration guide](https://mastra.ai/integrations/agentic-ui/copilotkit) introduces
`registerCopilotKit()` from `@ag-ui/mastra/copilotkit`. This template uses the same official
`@ag-ui/mastra` adapter (`MastraAgent`) with `@copilotkit/runtime/v2`, and the matching
`@copilotkit/react-core/v2` provider and hooks in the browser.

The runtime is assembled explicitly in `src/workspace/runtime.ts`. Its guarded `WorkspaceAgent`
validates requests and publishes only accepted results; `WorkspaceRunner` restores durable
snapshots on reconnect. The HTTP wrapper cancels analysis when the request disconnects.
In the installed adapter version (1.1.6), `registerCopilotKit()` accepts custom agents and runners,
but creates a runtime per request in single-route mode. This template retains one runtime in
multi-route mode and wraps the streaming response to preserve its cancellation behavior.
Do not replace it with an unguarded agent route: that would bypass the accepted-state boundary.

The catalog is a controlled, application-owned GenUI contract. It is not an A2UI catalog:
the Mastra `compose` tool selects registered views and the server validates their bindings.

## Sales request validation

The Sales worker parses the shared analysis contract and its capability-derived Sales schema
before opening the dataset. The schema owns supported fields and groupings, required dates,
closed filter values, and complete-month bounds for monthly churn series and customer cohorts.
Ungrouped churn and opportunity metrics still accept partial periods. Validation failures return
`invalid-input`; database failures return `source-unavailable`. Dataset coverage and result-size
checks remain runtime checks. Sales-specific rules stay in the adapter's contracts.

## Execution limits

Each question has separate budgets of eight model rounds and eight tool calls. Both `analyze`
and `compose` consume the tool-call budget, including multiple calls requested in one model round.
A sequential three-period comparison uses five model rounds and four tool calls, including the
final acknowledgement. Exceeding either budget fails the request and preserves the last accepted
workspace revision.

The existing bounds remain: 1,024 generated tokens per response, a five-second source timeout,
a 60-second analysis deadline, 1,000 result rows and 1 MiB of result data. Only an explicitly
retryable read may retry once; paid model calls are never automatically retried. Live benchmark
estimates use the model-round ceiling, not the sum of model rounds and tool calls.

## Separate servers

### Production authentication

The production Mastra bundle enables `SimpleAuth` for its API routes and for Studio when included
in a deployment. Before `npm start` or `npm run start:agent`, set `WORKSPACE_PROXY_TOKEN` to a
random secret of at least 32 characters, without surrounding whitespace. Generate one with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Store it in `.env` or your deployment's secret manager, on both servers. Production startup fails
when the token is missing or invalid. `npm run build:agent` uses a disposable token for configuration
inspection; the generated server requires the runtime secret and does not retain that build token.
The Mastra production build enables authentication even when `NODE_ENV` is unset at startup.
Local `npm run dev` does not require authentication by default and remains bound to loopback.

Direct API clients can send `Authorization: Bearer <token>`. The existing Next.js proxy sends
`x-workspace-token`, which the same provider accepts. Studio's native sign-in accepts the token
as its password. Authentication preserves the restrictions on native execution and memory writes.
`SimpleAuth` uses static tokens without automatic expiration; rotate the secret and restart both
servers when needed. It does not authenticate visitors to the Next.js application.

### Connection settings

The default `npm run dev` and `npm start` launch both processes on loopback for a local single-user
workspace. For separate servers, keep the browser on the Next.js origin:

```text
Browser → Next.js /api/* → configured Mastra server → data source and saved workspace
```

Set these server-side environment variables on **both** deployments:

```dotenv
MASTRA_SERVER_URL=https://agent.internal.example
WEB_ORIGIN=https://explorer.example
WORKSPACE_PROXY_TOKEN=<same-random-secret-of-at-least-32-characters>
```

`MASTRA_SERVER_URL` and `WEB_ORIGIN` accept HTTP(S) origins, without a path, credentials, query,
or fragment. Non-loopback `MASTRA_SERVER_URL` origins must use HTTPS; plain HTTP is accepted only for loopback connections.
The Next.js proxy ignores browser-supplied credentials and supplies its own token. Mastra checks
that token, its configured Host, and any Origin header before handling requests. Redirects are
not followed. Preserve the configured Host headers through deployment proxies; browser requests
must come from `WEB_ORIGIN`. These variables must never use the `NEXT_PUBLIC_` prefix.

On the **Mastra server**, also set `OPENAI_API_KEY`, `DATA_DIRECTORY`, and, if required by the
container network, `AGENT_HOST=0.0.0.0`. Keep `AGENT_PORT=4111` or set the desired listener port.
Prepare the selected source on this server. For the default Sales adapter and `.data` directory:

```bash
npm run data:init
npm run build:agent
npm run start:agent
```

For a custom data directory, pass its sales file to `data:init` with `-- --path /path/to/sales.sqlite`.
Keep the data directory on durable storage. Run one Mastra process per local workspace store.

On the **Next.js server**:

```bash
npm run build:ui
npm run start:ui -- --hostname 0.0.0.0 --port 3000
```

The UI server needs the connection settings and proxy token, but no model key or database files.
The application still has a single-user persistence model. Place the UI behind your private-access
or authentication gateway; the proxy token authenticates the two servers, not individual users.
No public deployment or multi-tenant isolation is provided by this template.
