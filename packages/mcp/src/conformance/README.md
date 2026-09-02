# MCP protocol conformance coverage

This directory launches the real `MCPServer` entry points. HTTP requests are routed through `startHTTP()` by an outer Node server; stdio runs `startStdio()` in a child process. Both paths are closed through `MCPServer.close()`.

Run the official 2026 HTTP smoke plus modern stdio interoperability:

```sh
pnpm --filter ./packages/mcp test:conformance -- --mode modern
```

Run the explicit 2025 compatibility smoke over HTTP and stdio:

```sh
pnpm --filter ./packages/mcp test:conformance -- --mode legacy-interoperability
```

The modern command deliberately runs the official `tools-list` scenario rather than the full server suite. The full suite requires fixture APIs that `MCPServer` does not advertise, including completions and deprecated sampling/roots behavior. Omitting those optional capabilities is not a conformance failure.

## 2026 coverage matrix

| Requirement                                                                                           | Coverage                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `server/discover`, per-request protocol metadata, required `resultType`, and HTTP method/name headers | Official `tools-list` scenario through `startHTTP()` plus `server-modern-era-http.test.ts`                                               |
| Stateless Streamable HTTP and built-in legacy fallback                                                | `server-modern-era-http.test.ts`; explicit legacy mode in this launcher                                                                  |
| Modern stdio opening exchange                                                                         | Modern stdio smoke in this launcher and `server-modern-era-stdio.test.ts`                                                                |
| `subscriptions/listen` acknowledgement, filtering, and closure                                        | `server-modern-era-http.test.ts` and `server-modern-era-stdio.test.ts`; client resource-subscription coverage is added in the next phase |
| Removed resource subscription and roots-list-changed methods                                          | Client assertions added in the next phase                                                                                                |
| Progress routing                                                                                      | `server/__tests__/logging-progress-emission.test.ts` and client progress tests                                                           |
| Cancellation and disconnect cleanup                                                                   | SDK transport behavior plus focused server/client lifecycle tests; no parallel cancellation implementation lives here                    |
| Explicit 2025 fallback                                                                                | `--mode legacy-interoperability` over HTTP and stdio                                                                                     |

`@modelcontextprotocol/conformance` is pinned exactly. A version bump must update this matrix and the exercised scenarios deliberately.
