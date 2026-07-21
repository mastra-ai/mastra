# Issue #19771 — Durable tool step swallows TerminalToolError

**Verdict: Invalid as framed (hallucinated API). Contains a legitimate feature idea + one real parity gap.**

## Issue

- **Title**: Durable tool step swallows `TerminalToolError` instead of terminalizing the run
- **Claim**: `createDurableToolCallStep`'s catch block serializes a `TerminalToolError` (marked `mastraTerminalToolError === true`) like any recoverable tool error instead of rethrowing it to fail the run.
- **Reporter**: dereky98 — 0 merged PRs; 3 issues filed the same day (#19770, #19771, #19772), all in identical "found while patching dist of @mastra/core@1.51.0" style. Strong AI-generated fingerprint.

## Root cause analysis: the API does not exist

Exhaustive search for `TerminalToolError` / `mastraTerminalToolError`:

| Search | Result |
|---|---|
| Current monorepo source | 0 matches |
| Entire git history, all branches (`git log --all -S`) | 0 matches |
| Published `@mastra/core@1.51.0` tarball (full dist) | 0 matches |
| Published `@mastra/core@1.52.0-alpha.9` (latest) | 0 matches |
| GitHub-wide code search for `mastraTerminalToolError` | 0 matches anywhere |
| GitHub-wide code search for `TerminalToolError` | ~20 hits, none Mastra-related |

The premise ("the marker strongly implies terminal errors are meant to propagate") describes a class/marker that has never existed in any Mastra version or artifact.

**Likely provenance**: `restatedev/vercel-ai-middleware` ships `rethrowTerminalToolError` / `hasTerminalToolError` / `isTerminalError` — Restate's durable-execution semantics for the Vercel AI SDK. The reporter (or their AI) conflated Restate's durable terminal-error concept with Mastra's durable agents (same problem domain, same vocabulary, wrong framework) and invented the `mastraTerminalToolError` marker.

## Contributing areas (actual code)

- `packages/core/src/agent/durable/workflows/steps/tool-call.ts:1167-1208` — durable catch block: serializes every error via `serializeError`, emits a `tool-error` chunk, returns it as a recoverable result. **By design** — mirrors the non-durable loop so the LLM can react to tool failures.
- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts:1290-1298` — non-durable equivalent. Rethrows exactly one class before serializing: `error.name === 'FGADeniedError'` (name check, not `instanceof` — deliberately dual-package-safe).

## Real findings buried in the invalid report

1. **Parity gap (bug-ish)**: the durable tool-call step has no `FGADeniedError` rethrow at all — FGA denials in durable runs get serialized as recoverable tool errors instead of failing the run like the non-durable path does.
2. **Feature gap (legit idea)**: no mechanism for a tool to declare an error unrecoverable and terminalize a durable run. Current escalation paths — serialized tool-error (default), TripWire via output processors (processor-driven, not tool-driven), abort signal (external), suspend (pause not terminate). A tool hitting a hard failure (revoked creds, deleted resource) can only feed errors back to the LLM, risking retry loops in long-lived durable runs.
   - If pursued: export a `TerminalToolError` (or marker) from `@mastra/core`, rethrow by name-check in both tool-call steps, emit a final error chunk before failing. Mechanically viable — a step throw fails the durable workflow into terminal `failed` state with existing snapshot/span cleanup. New public API → needs product buy-in.

## Related issues/PRs

- #19772 (same author) — `mergeRequestContexts` `instanceof` dual-package hazard; ironically the FGA name-check pattern is the in-repo mitigation for exactly that.
- #19770 (same author) — Code Mode `process.exit(0)` stdout truncation claim (not investigated here).
- restatedev/vercel-ai-middleware — external precedent for terminal tool errors in durable execution.

## Open questions

- Do maintainers want a tool-driven terminalize mechanism, or is TripWire-via-processor considered the sanctioned path?
- Should the FGA rethrow be ported to the durable step regardless?
