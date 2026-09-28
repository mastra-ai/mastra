---
name: live-mastracode-instrumentation
description: Reproduce and measure a Mastra Code runtime bug against a real model by driving the built TUI headlessly in tmux while every layer (network, provider stream, run engine, TUI) appends timestamped JSONL. Use when a bug depends on real provider timing, streaming order, or event flow that mocked tests and fixtures may not reproduce — e.g. wrong token rates, flicker, stuck status, ordering races, or "only happens sometimes with a real model".
---

# Live Mastra Code instrumentation

Run the real TUI against a real model, have an agent type the prompts, and log timestamps at each layer. Comparing the layers step by step shows where timing or ordering goes wrong: at the provider, in the network wrapper, in stream conversion, in the run engine, or in the UI reducer.

Pair this with `debugging-difficult-bugs`: instrument, reproduce, read the log before fixing, and clean up afterwards. Afterwards, turn the finding into deterministic checked-in coverage (unit tests plus a TUI E2E scenario under `mastracode/tui/e2e/tui/`). A live run is evidence, not a regression test.

## Cost and consent

The TUI uses the user's configured model and stored credentials (for example a Claude Max OAuth login), so every prompt spends their quota. Use short prompts. Tell the user which model you ran and roughly how many sessions.

## 1. Add temporary diagnostics

Append one JSON line per event to `<cwd>/debug-token-rate.jsonl` (or a similarly named file) with `appendFileSync`. Rules:

- **Metadata only**: timestamps, event types, ids, lengths, and token counts. Never log prompt, response, or tool content.
- Tag every record with a unique `build` marker (for example `'my-bug-diagnostics-v1'`). That lets you confirm the build you ran contains the instrumentation and find every leftover when cleaning up.
- Wrap each append in `try {} catch {}` so logging can never break the run.
- Log at the earliest and latest point of each layer you care about, so the timestamps can be lined up per step.

Useful hook points, from outermost to innermost:

| Layer           | Where                                                                                                                    | What to log                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network         | The provider's `fetch` wrapper, e.g. `buildAnthropicOAuthFetch` in `mastracode/sdk/src/providers/claude-max.ts`          | request start; headers arrival (status, `content-encoding`); each body chunk via a pass-through `TransformStream` (bytes, SSE `event:` names). Re-wrap the body with `new Response(body, { status, statusText, headers })`. |
| Provider stream | `convertFullStreamChunkToMastra` in `packages/core/src/stream/aisdk/v5/transform.ts`                                     | raw chunk type and delta length as the AI SDK hands it over                                                                                                                                                                 |
| Run engine      | `processStreamChunk` in `packages/core/src/agent-controller/session-run-engine.ts`                                       | chunk type, `getChunkProducedAt(chunk)`, current message id, step-start `startedAt`, usage. Skip per-delta chunks here if the provider layer already logs them.                                                             |
| TUI             | `mastracode/tui/src/tui/event-dispatch.ts` (web mirror: `mastracode/factory-ui/src/ui/domains/chat/services/runtime.ts`) | event type, ids, relevant state before and after, and any computed value (e.g. `usage.computed` with tokens, window, instantaneous and displayed rate)                                                                      |

For other providers, find the equivalent `fetch` option or wrapper in `mastracode/sdk/src/providers/`.

## 2. Build and verify the instrumentation shipped

```bash
pnpm install --frozen-lockfile   # fresh worktrees only
pnpm build:mastracode            # ~50s once deps are built
rg -l "my-bug-diagnostics-v1" mastracode/tui/dist packages/core/dist mastracode/sdk/dist
```

If `rg` finds nothing in a `dist`, the run will not produce that layer's records.

## 3. Drive the TUI in tmux

Use a throwaway git repo so the agent's tool calls cannot touch real work:

```bash
mkdir -p /tmp/mc-repro && git -C /tmp/mc-repro init -q
tmux new-session -d -s mcrepro -x 200 -y 50 -c /tmp/mc-repro \
  "node $PWD/mastracode/tui/dist/cli.js"
sleep 14   # startup
```

Send each prompt, then send `Enter` as a separate key press, then wait and read the screen:

```bash
tmux send-keys -t mcrepro "/new"; sleep 1; tmux send-keys -t mcrepro Enter; sleep 3
tmux send-keys -t mcrepro "Please do these one at a time as separate tool calls (not in parallel): write 3 files named a1.md through a3.md, each with a ~100 word paragraph about a different tree, writing a sentence of explanation before each tool call. Then run ls -la with execute_command and summarize in three sentences."
sleep 1; tmux send-keys -t mcrepro Enter
sleep 50
tmux capture-pane -t mcrepro -p | grep -v '^\s*$' | tail -3   # status line is last
```

Tips:

- Pick prompts that exercise the path under test. A multi-step, one-tool-at-a-time prompt produces a mix of thinking, text, and tool-argument steps.
- Loop the prompt several times, starting each with `/new`, because intermittent behavior needs a sample. Record what the screen showed each time so you can check the log against what the user would have seen.
- Rebuild and restart the tmux session after every code change. The TUI runs from `dist`.

## 4. Analyze per step

Group the log records by step (for example, split at each `usage.computed` or step-finish record) with a short `python3` script. For each step, compare durations across layers: request → headers → first content → last content at the network layer, and the same span at the provider, engine, and UI layers.

- Spans equal across layers mean the pipeline adds no distortion, so the behavior comes from the provider.
- A span that shrinks or grows between two layers is where the bug lives.
- To test a hypothesis, change one variable (for example send `accept-encoding: identity`), rebuild, and rerun.

Report the evidence as a small table (normal steps vs. anomalous steps), along with the model used, the number of runs and steps, and what the data cannot prove.

## 5. Clean up

```bash
tmux kill-session -t mcrepro
rg -n "my-bug-diagnostics" mastracode packages --glob '!**/dist/**'   # must print nothing
git diff --stat                                                        # only intended changes remain
rm -f debug-token-rate.jsonl /tmp/mc-repro/debug-token-rate.jsonl
```

Also revert any experiment toggles (like changed request headers) and confirm with `rg` before saying they are gone. Rebuild so `dist` no longer contains the instrumentation.
