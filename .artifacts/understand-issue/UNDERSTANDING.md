# Understanding: Issue #20329 — First-class isolated-vm transport for Code Mode

## Issue

- **#20329** "[FEATURE] First-class isolated-vm transport for Code Mode" — sgarfinkel, OPEN, labels: enhancement, Agents, Tools, needs triage, trio-tb, impact:high, effort:high.
- Requests a secure **in-process** V8-isolate transport (`IsolatedVmCodeModeTransport`) as an alternative to the default `StdioCodeModeTransport`, so Code Mode programs run with real isolation without needing a remote sandbox (E2B) or OS-level sandboxing.
- Proposed API: `createCodeMode(config, new IsolatedVmCodeModeTransport({ memoryLimitMb, timeoutMs }))`.
- Notes `isolated-vm` is the de facto standard for in-process V8 isolation; alternatives listed: OS-level isolation, remote sandboxes, QuickJS/WASM (as follow-up).

## Verdict

**Valid, well-researched feature request** — with one small genuine bug bundled in, and one hard DX constraint the issue underestimates. Agreed direction: **ship as a separate optional package** (e.g. `@mastra/isolated-vm`), not in core.

## Contributing areas

All in `packages/core/src/tools/code-mode/` unless noted:

| File | Role |
| --- | --- |
| `code-mode.ts` | `createCodeMode` / `createCodeModeTool`; defaults transport to `StdioCodeModeTransport`; **throws if no `sandbox`** (~line 87) |
| `transport.ts` | `StdioCodeModeTransport`: writes runner/program to host tmpdir (`mkdtemp`), spawns `node --experimental-strip-types`, parses `FRAME_PREFIX` frames, `serveRpc` with allow-list, races done/exit/timeout |
| `runner.ts` | `buildProgramModule`, `buildRunner`, `FRAME_PREFIX` — the in-sandbox runner + newline-delimited JSON frame protocol (rpc/log/done out, rpc-result in). All exported from `@mastra/core/tools` as public API |
| `types.ts` | `CodeModeTransport` interface — `run()` receives `sandbox`, `program`, `toolIds`, `dispatch`, `timeout`, `abortSignal`, observer hooks |
| `stub-generator.ts` | `generateStubs` + `createCodeModeInstructions` — **line ~195 hardcodes** "program runs in a sandbox: no access to host filesystem, network, or process" regardless of actual transport/sandbox |
| `workspaces/e2b/src/code-mode/transport.ts` | `E2BCodeModeTransport` (added in #19372, response to #19297): writes files into the VM via E2B files API, strips TS on host with esbuild, runs plain `node` in-VM, reuses the core frame protocol |

## History

- Code Mode shipped in #17324 ("let agents orchestrate tools with one TypeScript program").
- #19297 (CLOSED) reported the blog's E2B example failing immediately: `StdioCodeModeTransport` assumes host and sandbox share a filesystem. Fixed by shipping `E2BCodeModeTransport` in `@mastra/e2b` (#19372). PaulieScanlon confirmed the gap and the fix on the issue thread.
- #19878 later fixed flushing of large Code Mode results.
- #20329 is the next step in the same arc: the transport abstraction works, but there's still **no secure local option** — `StdioCodeModeTransport` + default `LocalSandbox` gives the child full host access (fs, network, env) unless seatbelt/bubblewrap is configured.

## Root cause analysis (of the gap)

1. **No in-process secure transport exists.** Only `StdioCodeModeTransport` (core, host tmpdir + child node process, no isolation by default) and `E2BCodeModeTransport` (remote micro-VM). The architecture supports a third transport cleanly — `CodeModeTransport` is a public single-method interface.
2. **Interface blocker (must fix in v1, not follow-up):** `createCodeModeTool` throws without a `sandbox`, and transports receive `sandbox` in `run()`. An isolate transport has no sandbox — core needs a way for a transport to declare "sandbox not required".
3. **Bundled bug:** `stub-generator.ts` instructions overstate isolation ("no access to host filesystem/network/process") — false for the default stdio+LocalSandbox path. Cheap standalone fix.

## isolated-vm dependency assessment (why separate package)

- **Status:** in maintenance mode per its README, but actively released (new versions within the last 3 months), ~890k weekly downloads, used in production by Algolia, Tripadvisor, Fly. Author maintains it "as long as technically feasible"; experimental rewrite exists but is not production-ready.
- **Hard DX problem:** Node >= 20 requires **`--no-node-snapshot` on the host process**. A library cannot set this for consumers — every user would need `NODE_OPTIONS` or a launch-flag change. This alone disqualifies it as a core default.
- **Native addon:** requires a compiler at install time (no prebuilds), even-numbered Node versions only. Pain in slim Docker/Alpine/CI. As a core dependency this would break installs for users who never use Code Mode; as an optional package it's opt-in.
- **Security is subtle:** leaking any `Reference`/`ExternalCopy` into the guest is a trivial escape back into the host isolate. The `dispatch` bridge (host tool calls from guest) is exactly the danger zone — validating the issue's argument for shipping this once, correctly, upstream rather than every user hand-rolling it.

## E2BCodeModeTransport as template — what transfers, what doesn't

- **Transfers:** the `CodeModeTransport.run()` contract — allow-list check before `dispatch`, observer hooks (`onExternalCall`/`onExternalResult`, best-effort/non-throwing), timeout race, `CodeModeToolResult` shape, log capture, `NoResultError` fallback. Also host-side TS stripping via esbuild (E2B does this to avoid `--experimental-strip-types` / Node-version coupling — an isolate transport needs the same since isolates run plain JS).
- **Does not transfer:** the entire frame protocol (`FRAME_PREFIX`, stdout parsing, stdin `rpc-result` writes). That exists only because of the process boundary. In-process, `external_*` functions are injected host callbacks calling `dispatch` directly — but each crossing must be carefully marshalled (copy values, never leak references).
- **Refactor signal (not required for this issue):** E2B's transport duplicates ~100 LOC of serveRpc/race logic from core's stdio transport. A third *process-based* transport (Modal, Daytona) would copy it again; a shared frame-bridge helper in core would pay off then.

## Recommended plan

1. **New optional package** `@mastra/isolated-vm` (workspaces/ or packages/, matching `@mastra/e2b` layout) exporting `IsolatedVmCodeModeTransport` with `{ memoryLimitMb, timeoutMs }` options. `isolated-vm` as a direct dep of that package only. Document the `--no-node-snapshot` requirement prominently; fail with an actionable error if the flag is missing.
2. **Core change:** allow sandbox-less transports — e.g. a `requiresSandbox?: boolean` (or similar) on `CodeModeTransport`, relaxing the throw in `code-mode.ts:~87`.
3. **Core fix (independent, cheap):** make `createCodeModeInstructions` isolation claims reflect the actual transport/sandbox instead of the hardcoded string at `stub-generator.ts:195`.
4. **Follow-up candidates** (out of scope): QuickJS/WASM transport (no native addon, no host flags — friction-free but slower; asyncify bridging quirks), `node --permission` hardening of the stdio transport (zero-dep; blocks fs/child-process but not network), shared frame-bridge extraction for process-based transports.

## Open questions

- Exact mechanism for "sandbox not required" in the transport contract (flag on transport vs. overload of `createCodeMode`).
- Whether `--no-node-snapshot` can be auto-injected by `mastra dev`/deployers to soften the DX cliff.
- Memory-limit/timeout semantics: isolated-vm memory limits are per-isolate heap; how to map onto existing `timeout` plumbing in `run()` opts.
- Marshalling policy for tool args/results across the isolate boundary (structured clone vs JSON round-trip).

## Related issues/PRs

- #19297 — E2B blog example failure (CLOSED; origin of the transport abstraction pressure)
- #19372 — added `E2BCodeModeTransport` to `@mastra/e2b`
- #17324 — original Code Mode PR
- #19878 — flush large Code Mode results
