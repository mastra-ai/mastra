# @mastra/code-sdk

The agent core behind [Mastra Code](https://mastra.ai) — everything except the terminal UI. Use it to build your own UIs and surfaces (web apps, editors, bots) on top of the Mastra Code coding agent.

The published [`mastracode`](https://www.npmjs.com/package/mastracode) CLI/TUI and the Mastra Code web surface are both built on this SDK.

## Installation

```bash
npm install @mastra/code-sdk
```

## Usage

Mount the Mastra Code agent controller on a Mastra instance:

```ts
import { mountAgentControllerOnMastra } from '@mastra/code-sdk';

// Creates a Mastra instance that hosts the Mastra Code agent controller
// (thread management, modes, tools, memory) and starts its workers.
const { mastra, controller } = await mountAgentControllerOnMastra({
  cwd: process.cwd(),
});
```

## ACP server

Start the installed CLI with `mastracode --acp`, or start the SDK server directly:

```ts
import { acpMain } from '@mastra/code-sdk/acp/index';

await acpMain();
```

The server uses newline-delimited JSON-RPC on standard input and output. Configure
provider authentication through Mastra Code before launching the client, or pass
API keys in the server's environment. ACP sessions do not load project `.env`
files into the shared process environment.

Each `session/new` creates its own runtime rooted at the request's absolute
`cwd`, including client-supplied MCP servers. Mode and model changes wait for
the current turn. Cancelling a session stops its active turn and cancels its
queued prompts.

Clients can use `configOptions` to select a model, mode, and requested reasoning
level. The reasoning choices follow Mastra Code's existing model policy; a
provider may adjust the requested level. For example:

```ts
await connection.setSessionConfigOption({
  sessionId,
  configId: 'thought_level',
  value: 'high',
});
```

Tool approvals and sandbox access requests go through the client's permission
UI. The `ask_user` tool is disabled because ACP has no free-text tool response
method. Internal signals, including user input and system reminders, are not
sent as assistant messages. Failed turns return protocol errors.

Model choices include authenticated providers and the session's saved current
selection. Labels retain the full provider/model ID, so an OpenRouter route such
as `openrouter/openai/gpt-4.1-mini` cannot be confused with a Netlify route.
Unauthenticated gateway catalogs are omitted; stale model choices must be refreshed.

Session loading is not supported yet. Configure authentication outside ACP;
the server does not advertise an interactive authentication method.

### Skills

The server advertises workspace skills through `available_commands_update` when
a session starts and refreshes the list before each prompt. Clients that support
ACP command discovery can offer `/skill/<name>` completions. Skills marked
`user-invocable: false` are omitted and cannot be explicitly invoked this way.
Skills are resolved through Mastra Code's existing project and global skill directories.
Duplicate names use the first user-invokable file in the workspace's catalog order.

Send the command as an ordinary text prompt, optionally followed by arguments:

```ts
await connection.prompt({
  sessionId,
  prompt: [{ type: 'text', text: '/skill/review Check the current changes' }],
});
```

The server loads the named skill's instructions and resource listings into the
turn. Missing or hidden skills return an invalid-parameters error without
starting inference. Each session uses its own workspace. Terminal commands such
as `/goal` are not advertised or implemented by this command handler.

### Focused adapter tests

From the repository root, after installing dependencies:

```sh
pnpm --filter @mastra/code-sdk test:acp
```

This suite runs the adapter and stdio protocol tests without building the TUI
or the workspace packages. Runtime factory tests mock SDK startup; use a running
ACP client to verify provider authentication and actual tool execution.

### Build ACP without rebuilding the workspace

For local adapter development, bundle the SDK source against an existing
installation of Mastra Code's published dependencies:

```sh
npm install --prefix /tmp/mastracode-runtime mastracode
pnpm --filter @mastra/code-sdk build:acp:dev /tmp/mastracode-runtime
node mastracode/sdk/node_modules/.acp-dev/local-acp.mjs
```

Point the ACP client's command at `node` with that generated file as its argument.
Rebuild after source changes. This development bundle uses absolute dependency
paths and is not a release artifact. It checks the local SDK against the installed
dependency versions; changes to other workspace packages still need their own
builds and tests.

### Validate the ACP wire protocol

Mastra Code implements [Agent Client Protocol v1](https://agentclientprotocol.com/protocol/v1/overview).
The similarly named `@acprotocol/conformance` package tests **Agent Control
Protocol**, a different protocol, and cannot validate this server.

The release gate tests the built SDK by default:

```sh
pnpm --filter @mastra/code-sdk test:acp:conformance
```

Build the SDK and its relevant workspace dependencies first. The command fails
if `dist/acp/index.js` is missing. It downloads the upstream v1 schema at revision
`367c56fb6115f391bc7550288363f87416cd0af8`, verifies its SHA-256 checksum, and installs
locked AJV validators with lifecycle scripts disabled. The first run needs network
access. Generated files stay under `node_modules/.acp-conformance`. The command
runs EOF, SIGINT and SIGTERM shutdown checks sequentially, with one server process
at a time.

To check a development bundle instead:

```sh
pnpm --filter @mastra/code-sdk build:acp:dev /tmp/mastracode-runtime --local-core
pnpm --filter @mastra/code-sdk test:acp:conformance node_modules/.acp-dev/local-acp.mjs
```

`--local-core` also bundles local `@mastra/core` source. Other workspace dependencies
still come from the supplied installation. This keeps local verification small;
it does not establish that the publishable packages build together.

The checker validates actual stdio JSON-RPC messages with AJV, independently of
the client's generated SDK validators. Local deterministic model and MCP fixtures
exercise the real runtime without model credentials or inherited user credentials.

| Supported behavior                                               | Verification                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Initialization, protocol version, capabilities                   | Wire responses and upstream schemas                                            |
| New sessions, absolute working directories, concurrent isolation | Separate runtime sessions and concurrent model requests                        |
| Text prompts, assistant streaming, usage and tool updates        | Wire schemas and adapter regressions                                           |
| Permissions                                                      | Approved writes execute; denied writes leave no file                           |
| Cancellation                                                     | Streaming, parked approvals, follow-up turns, and core startup regressions     |
| MCP stdio                                                        | Real tool calls with session working directory and environment                 |
| MCP HTTP and SSE                                                 | Real tool calls with supplied headers                                          |
| Modes, models and reasoning configuration                        | Selection validation, configuration updates and legacy mode notifications      |
| Errors and stop reasons                                          | Invalid requests, failed MCP setup, provider errors, token limits and refusals |
| Process lifecycle                                                | Disconnect, SIGINT/SIGTERM, MCP child exit, protocol-only stdout               |

Session loading/resuming, image/audio prompts, binary resources, interactive ACP
authentication, and free-text tool questions are outside this release profile.
They are not advertised as supported. Unsupported prompt attachments fail explicitly.
Clients supply credentials through the existing Mastra Code setup.

`node_modules/.acp-conformance/report/report.json` records the checks, errors,
observed message count, and SHA-256 hashes of the schema, server entry and checker.
The EOF report is at that path; SIGINT and SIGTERM reports are in the
`report/sigint` and `report/sigterm` subdirectories. Checks assert that started MCP
children exit after failed initialization and final shutdown.

The server hash covers the selected entry file; for the default release wrapper,
it does not fingerprint the entire dependency tree. Archive the package tarballs
and lockfile alongside the report for release provenance. Nonzero exit, malformed
stdout, timeout, or forced shutdown fails the gate.

Before publishing:

1. Run the focused adapter tests and affected core tests.
2. Build and typecheck the affected packages with matching workspace dependencies
   in CI, then run this gate against the resulting SDK artifact.
3. Smoke-test the packaged `mastracode --acp` entry in BB with a real authenticated
   provider, including a reply, approved and denied tools, and cancellation.
4. Archive the reports with the exact package versions and checksums.

Passing this gate supports a claim of tested compatibility with the documented
ACP v1 profile. It is not upstream certification or proof of every optional
protocol feature. Live-provider authentication remains a separate integration test.

## Documentation

- [@mastra/code-sdk documentation](https://mastra.ai/reference/code-sdk/mount-agent-controller)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/mastracode/sdk/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
