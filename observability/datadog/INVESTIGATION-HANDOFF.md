# DatadogBridge Investigation Handoff

This file is a working handoff for the ongoing DatadogBridge investigation.

It is intentionally long and redundant. The goal is to let a new coding agent resume quickly without needing to reconstruct the full debugging history from chat logs.

## Scope

This investigation is about `@mastra/datadog`, specifically bridge mode:

- `observability/datadog/src/bridge.ts`
- related tracing code in `observability/datadog/src/tracing.ts`
- the MCP client interaction that affects trace lifecycle in `packages/mcp/src/client.ts`
- how bridge-created dd-trace spans appear in Datadog APM and LLM Observability

The external validation harness used throughout this investigation is:

- `/Users/epinzur/src/mastra-test/dd-bridge`

That repo is linked to the local monorepo via `pnpm link:` paths for `@mastra/*`, so monorepo source changes are consumed directly by the repro harness after rebuild.

## Current High-Level State

Three meaningful fixes were made during this investigation:

1. `3d00c28fc7` `Use external ancestor for internal bridge context`
2. `57fad11b3a` `fix(mcp): detach persistent streamable-http GET from active trace`
3. `a48136d539` `fix(datadog): finalize event spans on span_ended`

These three changes materially improved the situation.

The original bad state was:

- bridge-mode APM often retained only downstream MCP spans
- entry service often disappeared from stored APM
- `DD_TRACE_PARTIAL_FLUSH_MIN_SPANS=5` made entry data show up, which suggested trace lifecycle / flushability problems
- some dependency spans were hanging under generic `handler` spans rather than logical Mastra spans

The current improved state is:

- entry service spans can now appear again in stored APM in bridge mode
- entry runtime definitely emits APM trace payloads in normal bridge mode, without needing forced partial flush
- the MCP persistent `GET` stream is detached from active trace context
- internal Mastra spans now activate the nearest external ancestor in bridge context
- event spans that terminate via `span_ended` are no longer leaked until shutdown

The remaining open question is narrower:

- whether the stored APM trace now consistently retains the full expected entry-side semantic Mastra spans, or whether some semantic spans are still missing relative to the locally encoded payload and the Datadog UI

## Important Repos and Paths

### Monorepo

- `observability/datadog/src/bridge.ts`
- `observability/datadog/src/bridge.test.ts`
- `observability/datadog/src/tracing.ts`
- `packages/mcp/src/client/client.ts`
- `packages/mcp/src/client/client.test.ts`
- `observability/mastra/src/spans/base.ts`
- `observability/mastra/src/tracing.test.ts`

### External Repro Harness

- `/Users/epinzur/src/mastra-test/dd-bridge`
- `/Users/epinzur/src/mastra-test/dd-bridge/datadog-journal.md`
- `/Users/epinzur/src/mastra-test/dd-bridge/codex-handoff.md`
- `/Users/epinzur/src/mastra-test/dd-bridge/scripts/fetch-datadog-trace-sdk.ts`

## Commits Made During This Investigation

### 1. Internal span context fix

Commit:

- `3d00c28fc7` `Use external ancestor for internal bridge context`

Summary:

- internal spans were calling bridge context activation with span ids that were never registered in the Datadog bridge map
- this showed up as `executeWithSpanContext()` missing-map fallbacks during `runStep(...)`
- the fix was to make internal spans activate their nearest external ancestor in the bridge context path

Files:

- `observability/mastra/src/spans/base.ts`
- `observability/mastra/src/tracing.test.ts`

Impact:

- reduced bogus missing-map fallbacks
- improved context activation for auto-instrumented dependency spans triggered under internal step execution

### 2. MCP persistent GET detachment

Commit:

- `57fad11b3a` `fix(mcp): detach persistent streamable-http GET from active trace`

Summary:

- the MCP Streamable HTTP client opens a long-lived `GET` stream
- that persistent `GET` was being created inside the active request trace
- this likely contaminated the user request trace and contributed to entry-side APM retention problems
- the fix detaches only the persistent stream `GET` from active dd-trace scope while keeping bootstrap and tool `POST`s in request context

Files:

- `packages/mcp/src/client/client.ts`
- `packages/mcp/src/client/client.test.ts`

Impact:

- entry service retention improved materially
- trace shape became healthier
- entry was no longer disappearing as often from stored APM

### 3. Event span finalization bug

Commit:

- `a48136d539` `fix(datadog): finalize event spans on span_ended`

Summary:

- the bridge used to treat event spans as terminal only on `span_started`
- in practice, some event spans such as `chunk: 'tool-result'` reached the bridge as `span_ended`
- those spans were logged as `Ignoring event span tracing event`
- they stayed open in `ddSpanMap` until shutdown force-finished them
- that likely blocked normal trace completion / flushability on entry

Files:

- `observability/datadog/src/bridge.ts`
- `observability/datadog/src/bridge.test.ts`
- `observability/datadog/src/tracing.ts`

Impact:

- event spans are now finalized on both `span_started` and `span_ended`
- entry runtime started emitting a normal `/v0.4/traces` request without forced partial flush
- this is one of the strongest candidate root-cause fixes from the whole investigation

## External Repro Setup Used Repeatedly

The repro app has three processes:

- `entry-server`: Mastra + Koa, user-facing agent
- `mcp-server-mastra`: Mastra + Koa exposing MCP tools
- `mcp-server-bare`: bare MCP server on Koa

Bridge-mode commands used frequently:

### Bare MCP

- MCP:
  - `MASTRA_DATADOG_BRIDGE_SPAN_DEBUG=1 pnpm dev:dd:bridge:mcp:bare`
- Entry:
  - `MASTRA_DATADOG_BRIDGE_ENABLED=1 MASTRA_DATADOG_BRIDGE_SPAN_DEBUG=1 DD_TRACE_DEBUG=true LOG_LEVEL=debug DD_SITE=datadoghq.eu DD_LLMOBS_ENABLED=1 DD_LLMOBS_ML_APP=dd-bridge-entry DD_SERVICE=dd-bridge-entry NODE_OPTIONS='--import dd-trace/register.js ${NODE_OPTIONS:-}' MCP_BACKEND=bare node --env-file=.env --import tsx/esm src/servers/entry-server.ts`
- Trigger request:
  - `pnpm test:entry`

### Mastra-backed MCP

- MCP:
  - `MASTRA_DATADOG_BRIDGE_SPAN_DEBUG=1 pnpm dev:dd:bridge:mcp:mastra`
- Entry:
  - `MASTRA_DATADOG_BRIDGE_ENABLED=1 MASTRA_DATADOG_BRIDGE_SPAN_DEBUG=1 DD_TRACE_DEBUG=true LOG_LEVEL=debug DD_SITE=datadoghq.eu DD_LLMOBS_ENABLED=1 DD_LLMOBS_ML_APP=dd-bridge-entry DD_SERVICE=dd-bridge-entry NODE_OPTIONS='--import dd-trace/register.js ${NODE_OPTIONS:-}' MCP_BACKEND=mastra node --env-file=.env --import tsx/esm src/servers/entry-server.ts`
- Trigger request:
  - `pnpm test:entry`

Datadog fetch script:

- `node --env-file=.env --import tsx/esm scripts/fetch-datadog-trace-sdk.ts <TRACE_ID> --from=now-2h --page-delay-ms=4000 --verbose`

## What Was Originally Reproduced

The original confirmed findings from the repro harness were:

1. Baseline `dd-trace`

- direct OpenAI quickstart appeared in both Datadog LLM Observability and APM
- Mastra flows appeared in APM but not in LLM Observability

2. `DatadogExporter`

- LLM Observability worked for Mastra
- APM still worked
- cross-process LLMObs stitching did not happen
- `mcp-mastra` APM was noisy
- `mcp-bare` APM was cleaner

3. Customer-relevant bug without bridge

- downstream dependency spans in APM were parented to generic framework spans like `handler` instead of logical Mastra spans like `mcp_tool`

4. Original bridge regression

- LLM Observability showed the expected traces
- but APM stored only MCP-side spans
- entry service disappeared from stored traces

## Working Theory Evolution

This investigation went through several hypotheses. Some were useful, some were wrong.

### Hypothesis: bad parent ids

This became much less likely after logging showed:

- entry semantic spans were created with valid parent ids
- `agent run` was under the entry request / Koa handler chain, which is correct for APM
- `llm` was a child of `agent run`
- `step` was a child of `llm`
- `mcp_tool` spans were children of `step`
- local `tool:` spans were created with sensible semantic parents

Conclusion:

- parent ids were not the main problem

### Hypothesis: bridge disabled or not creating entry spans

This was partially true for one accidental repro command because of a malformed env assignment:

- `MASTRA_DATADOG_BRIDGE_ENABLED=1=true`

That was corrected.

After correction:

- entry bridge was definitely active
- entry semantic spans were definitely being created and finished locally

Conclusion:

- not the root cause

### Hypothesis: LLM Observability integration was poisoning APM

This was tested by temporarily disabling bridge-side LLMObs registration / annotation.

Result:

- no clear APM improvement
- but the experiment exposed the event span leak more clearly

Conclusion:

- LLMObs may still be architecturally awkward, but it was not the best immediate explanation for the missing entry APM data

### Hypothesis: partial flush was the key

This was strongly supported:

- `DD_TRACE_PARTIAL_FLUSH_MIN_SPANS=5` caused entry APM and entry semantic spans to appear in stored APM
- without partial flush, entry often disappeared or only partially appeared

Interpretation:

- something was keeping the trace from becoming flushable under default behavior

This eventually pointed toward:

- persistent MCP `GET` stream
- leaked event spans

### Hypothesis: shutdown was the main issue

This was investigated because:

- the repro servers originally did not guarantee `mastra.shutdown()` on `Ctrl-C`
- the bridge code used a no-op `(tracer as any).flush()`

Findings:

- graceful shutdown in the harness was later fixed
- `process.exit()` had been bypassing dd-trace `beforeExit` handlers, and that was corrected
- however, graceful shutdown alone was not the main fix
- the no-op tracer flush was removed

Conclusion:

- shutdown cleanup mattered for clarity, but it was not the main root cause

### Hypothesis: leaked event spans were blocking trace completion

This became the strongest finding.

Evidence:

- event spans such as `chunk: 'tool-result'` were created
- later `span_ended` arrived
- bridge ignored them by design
- they remained open until shutdown
- after fixing this, entry runtime emitted APM payloads normally

Conclusion:

- this is a real root-cause bug

## Important dd-trace Findings

### Public tracer flush does not exist on Node tracer

Runtime checks in the repro showed:

- `typeof tracer.flush === 'undefined'`
- `typeof tracer._tracer?.flush === 'undefined'`
- `typeof tracer._tracer?._exporter?.flush === 'function'`

Implications:

- `(tracer as any).flush()` was effectively a no-op
- it should not be relied on for APM flushing

### Default partial flush threshold

The Node `dd-trace` default partial flush threshold is `1000` spans.

This made the `DD_TRACE_PARTIAL_FLUSH_MIN_SPANS=5` experiment useful because it clearly changed behavior.

### Exporter internals

The actual APM exporter flush function exists internally:

- `tracer._tracer._exporter.flush(done)`

This was used only for debugging. It should not be the long-term product dependency unless absolutely necessary.

### beforeExit behavior

`dd-trace` relies on a `beforeExit` handler for last-chance exporter flush behavior.

This matters because:

- explicit `process.exit(...)` bypasses `beforeExit`
- the repro harness originally did this
- the harness shutdown helper was later corrected to avoid forcing `process.exit(...)` on the successful path

## Why the MCP Patch Matters

The MCP fix should not be treated as incidental.

The persistent Streamable HTTP `GET` stream was long-lived and visible in traces:

- it was opened under the active request trace originally
- later runs showed it with durations around tens of seconds

This meant:

- user-request trace topology was polluted by a persistent transport stream
- request flushability and retention were likely affected

Detaching only the persistent `GET` while keeping the request-scoped `POST`s traced was the right narrow fix.

That design preserves:

- actual bootstrap and tool `POST`s inside request context
- the user-visible request latency caused by bootstrap/discovery
- the cleaner separation of long-lived transport from logical business work

## Why the Event Span Fix Matters

This is likely the most important product-level fix so far.

Before the fix:

- bridge created dd spans for some event spans
- those event spans were never finalized in normal runtime when the terminal signal was `span_ended`
- trace completion could be delayed or blocked until shutdown

After the fix:

- those event spans finish normally
- entry can send a runtime APM payload without relying on `DD_TRACE_PARTIAL_FLUSH_MIN_SPANS`

This is a real improvement in lifecycle correctness.

## Trace IDs Worth Knowing

These trace ids were especially useful during debugging:

### Successful partial flush proof

- `69e77ee80000000079ce7b57219554fa`

Important because:

- with `DD_TRACE_PARTIAL_FLUSH_MIN_SPANS=5`, Datadog stored entry semantic spans in APM
- this proved the spans themselves were valid and storable

### Event-span fix verification trace

- `69e78cbb00000000733eeb03a7d94e61`

Important because:

- after the event-span fix, entry runtime sent a normal `/v0.4/traces` request
- initial Datadog fetch was incomplete
- later retry returned `83` spans and clearly included `dd-bridge-entry`

This trace is the best single artifact to continue from.

## Current Package State

At the time this handoff file was written, the working tree had been committed and was clean.

Relevant recent commits:

- `a48136d539` `fix(datadog): finalize event spans on span_ended`
- `57fad11b3a` `fix(mcp): detach persistent streamable-http GET from active trace`
- `3d00c28fc7` `Use external ancestor for internal bridge context`

If a new agent starts from these commits, it should be able to reproduce the current improved state.

## Temporary Debug Logging That Exists

`observability/datadog/src/bridge.ts` currently includes a large amount of temporary diagnostic logging.

This includes:

- `spanLifecycleDebug` config / env toggle
- dd span open / finish logs
- map-size logs
- fallback logs for missing-map activation
- call stack logging on missing-map fallback
- trace debug state helpers

This logging was useful and should be expected in the current bridge implementation.

It is not necessarily intended as final product behavior.

A future cleanup pass should probably reduce or remove it once the bridge investigation is fully resolved.

## What Still Needs To Be Answered

The investigation is now much narrower than when it started.

The main remaining question is:

- does Datadog stored APM now retain the full expected entry-side semantic span set consistently after the MCP and event-span fixes?

This should be checked specifically for:

- `agent run`
- `llm`
- `step`
- `mcp_tool`
- local `tool:` spans

Possible outcomes:

### Outcome A: semantic entry spans are now present in stored APM

If this is true consistently, then:

- the major bridge regression is basically fixed
- remaining cleanup is mostly:
  - removing debug logging
  - tightening tests
  - maybe improving docs

### Outcome B: entry exists in stored APM, but some semantic spans are still missing

If this is true, then:

- the major lifecycle bugs were fixed
- a smaller Datadog retention / chunking / indexing nuance remains
- that follow-up problem is narrower and less severe than the original “entry disappears entirely” regression

### Outcome C: results are inconsistent between UI and fetch script

If this is true, then:

- continue to account for Datadog indexing lag
- avoid over-trusting the first fetch
- compare:
  - raw runtime `Encoding payload`
  - runtime `Request to the agent: {"path":"/v0.4/traces"...}`
  - later Datadog fetch results
  - UI display

## Recommended Next Steps For A New Agent

### 1. Start from the known-good commit state

Use the current commit chain:

- `3d00c28fc7`
- `57fad11b3a`
- `a48136d539`

### 2. Re-run the bare bridge repro first

This is the cleanest signal and smallest span volume.

Recommended sequence:

1. start `mcp-bare`
2. start bridge-enabled `entry`
3. send one request with `pnpm test:entry`
4. inspect entry runtime logs for:
   - semantic span creation
   - event span finalization
   - runtime `/v0.4/traces` send
5. fetch the trace later, not immediately

### 3. Verify whether stored APM now contains semantic entry spans

Do not stop at “entry service exists.”

Specifically verify whether stored APM includes:

- `agent run`
- `llm`
- `step`
- `mcp_tool`
- `tool:`

### 4. Only after bare is understood, move back to `mcp-mastra`

The Mastra-backed MCP case is much noisier.

Use it only after the bare case is clearly understood.

### 5. If semantic spans are still missing, compare payload shapes

If the problem persists:

- compare the locally encoded entry payload against the later Datadog stored result
- determine whether missing spans are absent before send or lost after send

### 6. Clean up temporary debug logging only after confidence is high

The debug logging is noisy but helpful.

Do not remove it too early if the bridge is still under active investigation.

## Useful Notes For Whoever Continues This

### Do not over-interpret the first Datadog fetch

Several times during this investigation:

- first fetch returned far too few spans
- later retry returned a much fuller trace

The trace `69e78cbb00000000733eeb03a7d94e61` is a concrete example:

- initial fetch looked MCP-only
- later retry showed `dd-bridge-entry`

### The bridge issue is now much smaller than it was

Earlier in the investigation, the system looked badly broken.

Now the evidence is much closer to:

- the bridge had a couple of real lifecycle bugs
- those bugs have been fixed
- the remaining issue may be limited to stored semantic retention consistency rather than total trace disappearance

### The customer-facing impact should be re-evaluated after these fixes

The original customer-visible bug was severe:

- entry APM disappearing
- dependency parentage wrong

After the current fixes, the actual remaining customer impact may be smaller than the initial repro suggested.

That should be re-measured from current commits, not inferred from the earlier broken state.

## Short Executive Summary

If you only read one section, read this:

- The bridge had two real lifecycle bugs:
  - internal spans activating non-registered ids
  - event spans created by the bridge but ignored on `span_ended`
- The MCP client also traced a persistent `GET` stream inside the user request trace, which made trace lifecycle noisier.
- Those issues have been fixed in:
  - `3d00c28fc7`
  - `57fad11b3a`
  - `a48136d539`
- After these fixes:
  - entry service spans can appear again in stored APM
  - entry runtime now emits normal APM payloads without forced partial flush
- The remaining task is to verify whether stored APM now consistently includes the full expected entry-side semantic span set, or whether a smaller Datadog retention nuance remains.
