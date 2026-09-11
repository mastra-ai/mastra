# MCP protocol conformance coverage

This directory launches the real `MCPServer` entry points. HTTP requests are routed through `startHTTP()` by an outer Node server; stdio runs `startStdio()` in a child process. Both paths are closed through `MCPServer.close()`.

Run the official 2026-07-28 HTTP smoke, the modern stdio opening exchange and the legacy-stdio rejection check:

```sh
pnpm --filter ./packages/mcp test:conformance
```

The command deliberately runs the official `tools-list` scenario rather than the full server suite. The full suite requires fixture APIs that `MCPServer` does not advertise, including completions and the deprecated sampling/roots behavior that `@mastra/mcp` 2.x removes. Omitting those optional capabilities is not a conformance failure.

## 2026-07-28 coverage matrix

| Requirement                                                                                           | Coverage                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `server/discover`, per-request protocol metadata, required `resultType`, and HTTP method/name headers | Official `tools-list` scenario through `startHTTP()` plus `server-modern-era-http.test.ts` |
| Self-contained Streamable HTTP with no session or `initialize`                                        | `server-modern-era-http.test.ts` and `client-modern-lifecycle.test.ts`                     |
| Modern stdio opening exchange; legacy stdio openings rejected                                         | This launcher and `server-modern-era-stdio.test.ts`                                        |
| `subscriptions/listen` acknowledgement, filtering, replacement, reconnect, and closure                | `server-modern-era-http.test.ts` and `client-modern-lifecycle.test.ts`                     |
| Removed `resources/subscribe`, roots, sampling, `logging/setLevel` and legacy protocol revisions      | Wire-level rejection assertions in `server-modern-era-http.test.ts`                        |
| Native `input_required` continuation for tools, resources and prompts                                 | `native-input-required.test.ts` and `client-modern-lifecycle.test.ts`                      |
| Per-request logging and progress routing                                                              | `server-modern-era-http.test.ts` and client logging/progress tests                         |
| Cancellation and disconnect cleanup                                                                   | SDK transport behavior plus focused server/client lifecycle tests                          |

`@modelcontextprotocol/conformance` is pinned exactly. A version bump must update this matrix and the exercised scenarios deliberately.
