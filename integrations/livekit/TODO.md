# `@mastra/livekit` — next iteration TODO

Implementation + tracking for the next iteration of the package and the `examples/voice-agent`
reference. Driven by Plancraft's feedback (trades phone assistant: lead capture, inspection
intake + service-area check, general callback).

**How to use:** check off `- [ ]` items as they land. Status legend: `P0` decide/unblock now ·
`P1` core build · `P2` polish. Owners: **M** = Michael · **C** = Claude · **PC** = Plancraft.

---

## DTMF / phone menu navigation (2026-10-20)

- [x] Add opt-in `dtmf: true` for telephony workers and a per-call `createDtmfTool()` factory for custom workers.
- [x] Use only native `LocalParticipant.publishDtmf()` for keypad publishing; add no tone synthesis, pacing, retries, or menu state machine.
- [x] Execute call-bound tools through Mastra toolsets locally and the existing client-tool API remotely. Return acknowledged digits and partial failures to the model.
- [x] Require the intended SIP caller in a dedicated room; reject overlapping sequences and speculative generation. Honor turn cancellation between native publishes.
- [x] Verify local, remote, and standard-worker paths with 24 native-room integration tests, including real Mastra server authentication, tool continuation, and Memory persistence.
- [x] Repeat cancellation and simultaneous-call isolation 20 times. Removing native publishing fails all three packet-delivery cases; restoring it passes them.
- [x] Verify the existing client SDK minimum (1.51.2), both supported Zod majors, build, lint, source/test types, and public documentation examples. Initial DTMF verification passed 385 enabled package tests. PostgreSQL verification below brings the full suite to 386 passing tests with none skipped.
- [ ] Verify actual carrier/phone-menu acceptance: single digits, multi-digit sequences, `*`/`#`, interrupted sequences, and hang-up. Native packet delivery does not prove that a remote menu accepted the keys.
- [ ] Validate adoption in an existing worker, replacing overlapping DTMF interception with the call-bound tool. Menu strategy and application-specific prompts remain application responsibilities.

Run the native tests against a disposable local LiveKit server (no SIP trunk or phone number needed):

```sh
livekit-server --dev --bind 127.0.0.1 --port 17880
LIVEKIT_TEST_ROOM_URL=ws://127.0.0.1:17880 pnpm --filter @mastra/livekit test src/dtmf-room.test.ts
```

The fixture uses real native rooms and audio publications with SIP-kind test participants. The paid model and telephone-provider boundaries are simulated. Public usage and result semantics are documented in the canonical LiveKit integration guide under **Navigate phone menus**.

## Telephony orchestration (2026-10-20)

- [x] Add opt-in worker setup using native LiveKit SIP clients, types, answer waiting, timeouts, and errors.
- [x] Resolve inbound routing and Memory identifiers from the native SIP participant before agent selection.
- [x] Bind session input to the selected caller and preserve browser startup when telephony is omitted.
- [x] Support explicit cleanup of dedicated call rooms without hiding the original setup failure.
- [x] Verify 19 HTTP SDK tests and five native-room tests, including real Memory persistence; 361 enabled package tests pass.
- [x] Prove the answer-wait and caller-selection regressions fail when those behaviors are removed; repeat native caller isolation 20 times.
- [x] Check supported Zod 3/4, package build/lint/types, and canonical documentation examples.
- [ ] Verify a controlled carrier/audio call: answer-before-greeting, busy/no-answer behavior, interruptions, and shutdown. No real phone call has been placed by automated tests.
- [ ] Validate adoption in an existing worker and remove only overlapping dialing/startup and inbound metadata glue.

See `telephony-orchestration-prd.md` for the approved boundary, verification commands, and limitations. DTMF is covered by the follow-up above. Call records, durable completion delivery, and project resolution remain outside this change.

## Release verification — transcript persistence (2026-10-15)

- [x] **PostgreSQL verification (2026-10-20).** Passed against disposable PostgreSQL 16.15
      (`postgres:16-alpine`, localhost-only port, temporary in-memory data). Verified initial
      interrupted text/metadata, an update to the already-stored message, duplicate-event replay,
      stable IDs, equal-timestamp ordering, and shutdown flushing through a separate PostgreSQL
      connection using real Mastra Memory recall. Discarding revisions makes the test fail on the
      saved text; restoring the implementation passes. No production-code changes were required.
      Tested workspace `@mastra/pg` 1.31.2-alpha.1 and `@mastra/memory` 1.38.0-alpha.0 on Node 22.22.3.
      Semantic recall was off; embeddings/vector search and production-database latency were not
      part of this check. With PostgreSQL and native LiveKit room tests enabled, all 386 package
      tests pass with none skipped. Focused test types and lint pass.
- [ ] **Controlled live voice-call check.** Verify greeting persistence, normal turns,
      barge-in and resumed speech, tool history, and final transcript flushing on hang-up.
      Compare committed LiveKit conversation items with saved Memory messages and measure
      next-turn latency with transcript persistence enabled.

## Stable dependency audit (2026-10-15)

The shared-session and transcript work is recovered on `codex/livekit-stable-dependencies`.
**Release decision, 2026-10-19:** Require Agents and installed LiveKit/Silero plugins `^1.9.3`.
Their native RTC peer requirement is `^1.1.0`. This raises the supported minimum and is recorded
as a breaking change. The integration API is unchanged; versioning and publication remain pending.
Only the LiveKit package's importer and new dependency graph change in the shared lockfile.

| Dependency | Previous installed version | Updated stable version |
| --- | --- | --- |
| Agents, LiveKit plugin, Silero plugin | 1.7.1 | 1.9.3 |
| RTC peer selected by LiveKit | 0.13.34 | 1.1.0 |
| Server SDK | 2.16.0 | 2.19.1 |
| Direct protocol dependency | 1.49.0 | 1.52.1 |
| Zod used for development | 4.6.5 | 4.6.7 |
| Vitest | 4.1.11 | 5.0.5 |
| tsdown | 0.22.9 | 0.23.1 |
| ESLint | 10.7.0 | 10.12.0 |
| Hono used for integration tests | 4.13.7 | 4.13.13 |
| Node type definitions | 22.19.15 (workspace override) | 26.6.5 (LiveKit-only override) |

Vite 8.3.4 is now an explicit development dependency because Vitest 5 makes it a peer.
TypeScript was already at the latest stable 7.0.2. Mastra workspace dependencies stay linked;
this task does not upgrade or edit core, server, memory, or storage packages.

### Compatibility and migration impact

- **RTC peer range changes upstream.** Agents/Silero 1.9.3 require RTC `^1.1.0`.
  Update applications that explicitly pin RTC 0.13.x, keeping Agents and plugins on the same
  exact release. RTC's 1.0 release marks it stable; 1.1 adds the RPC interceptor required by Agents.
  The integration now requires `^1.9.3` for Agents and installed plugins. The previous
  Agents 1.7.1 / RTC 0.13.x combination is no longer supported for this release.
- **Token verification requires expiration.** Server SDK 2.19.1 rejects tokens without `exp`.
  The connection route already uses LiveKit's expiring `AccessToken`; a regression assertion
  verifies its signed token with the real `TokenVerifier`.
- **LiveKit telemetry changes.** Several trace durations switch from milliseconds to seconds,
  and configured OpenTelemetry exporters can receive conversation content. The canonical LiveKit
  guide lists the native controls and migration details. Mastra's `*Ms` metric fields keep their units.
- **Transport and transcript behavior.** Dead native session transports reject sends immediately.
  Legacy transcription packets are suppressed for stream-capable clients; committed conversation
  events and `lk.transcription` text streams remain available. No replacement transport or
  transcription logic was introduced.
- **Development runtime.** tsdown 0.23 requires Node `^22.18.0 || ^24.11.0 || >=26.0.0`;
  Vitest 5 also excludes Node 25. Validation uses Node 24.18.0. Published runtime support remains
  Node >=22.13.0. Vitest 5 clears mock call history by default; the existing tests pass with that behavior.
- **Upstream pins remain authoritative.** RTC still pins FFI bindings 0.12.73; the turn detector
  still pins Transformers 4.2.0 and ONNX Runtime 1.24.3. Their newer standalone releases are not
  overrides: native ABI/model compatibility belongs to LiveKit. Server SDK pins protocol 1.51.0
  alongside the integration's 1.52.1. Other major lines, including OpenAI 6, Pino 8/9, and protobuf 1,
  remain within upstream requirements. The workspace's existing jose 6.2.12 security override
  is unchanged; the published Server SDK itself still declares jose 5.

### Validation

- [x] Latest stable SDK suite: 337 passed; PostgreSQL test skipped pending its release check.
- [x] Zod 3 compatibility suite: 337 passed; PostgreSQL test skipped.
- [x] Historical check before the minimum was raised: LiveKit 1.7.1 suite passed 337 tests.
  This records the earlier audit only; it is not a supported dependency combination for this release.
- [x] ESM, CommonJS, and declarations built; all four entry points imported in both module formats.
- [x] Package lint and source TypeScript check passed.
- [x] Packed consumer with published stable core 1.77.0, client-js 1.54.0, Memory 1.37.1,
  and LibSQL 1.26.1: all ESM/CommonJS exports loaded, and a native text session persisted its
  greeting, caller input, and reply through Memory. This does not replace the live audio check.
- [x] Canonical guide formatting, Remark, and Vale passed; frozen install passed.
- [x] Required-version check (2026-10-19): npm's strict peer resolver accepts the packed
  integration with Agents/plugins 1.9.3 and RTC 1.1.0, including installation without the optional
  plugins. The same older 1.7.1 combination accepted by the previous package is rejected by the
  new package specifically because its Agents peer requirement is now `^1.9.3`.

The isolated stable consumer reports the existing client-js dependency on older AI SDK utilities
whose peer range declares Zod 3. The Zod 4 consumer check and both integration Zod suites pass;
no override or client-js package change was added for that upstream peer warning.

An additional check that includes every test file in TypeScript reports 14 existing fixture
diagnostics. The same diagnostics reproduce on the recovered commit with the old dependencies;
the package's configured source/declaration checks exclude tests. This is separate from the
passing runtime test suites and is not a regression from this dependency refresh.

Sources: [Agents changelog](https://github.com/livekit/agents-js/blob/main/agents/CHANGELOG.md),
[RTC changelog](https://github.com/livekit/node-sdks/blob/main/packages/livekit-rtc/CHANGELOG.md),
[Server SDK changelog](https://github.com/livekit/node-sdks/blob/main/packages/livekit-server-sdk/CHANGELOG.md),
[Vitest migration](https://vitest.dev/guide/migration/),
[tsdown 0.23](https://github.com/rolldown/tsdown/releases/tag/v0.23.0).

---

## Decision log

- **2026-07-06 — Defaults are permissive; ALL safeguards live on the regulated line (M's steer).**
  The default Meridian workers (agent + workflow) carry no compliance friction: no
  `requireConsent`, no consent tool/instructions on the `callCenter` agent, no periodic
  re-disclosure — the end-of-call summary always runs. Every safeguard (consent sweep +
  ledger + gated summary, `repeatEvery` re-disclosure, non-interruptible greeting) is
  demonstrated in one place: `voice-worker-regulated.ts` + `super-regulated-agent` +
  `tools/compliance-tools.ts`. Surfaced by live-call testing: the consent gate silently
  skipped the summary on an ordinary demo call.

- **2026-06-28 — Primitive: agent-driven, not workflow-driven.** The agent loop is the per-turn
  engine. Reasoning: semantic recall / memory / context and barge-in are agent-native; the
  suspend/resume workflow path was unreliable under interruptions and carried no state between
  turns. Determinism comes from **Processors + tools + small workflows-as-tools**, not from
  driving the call as a workflow.
  - **Keep** the workflow entrypoint (run-to-completion, Phase 1) as a supported option — do not
    remove it.
  - **Drop** suspend/resume-per-turn from the roadmap (revisit only if a hard requirement for
    durable cross-process resume appears).
  - **Focus** the integration and example on the agent-loop experience.

---

## Customer follow-ups — Porta (2026-07-06)

Porta ran the `examples/voice-agent` reference and pushed it toward their multi-tenant PORTA setup
(one registered agent; dynamic tools/inputProcessors keyed on the dialed number; user-configured
qualification questions validated in a finalize tool, kept out of the prompt). Six follow-ups, with
where each lands against the current package. Working detail lives in `followup-meeting.md` (temp).

- [ ] **1 — Dialed number → `requestContext` for one multi-tenant agent.** `requestContext` is built
      once from `ctx.job.metadata` **before** `ctx.connect()` (`worker.ts`) and frozen into the
      agent, so post-connect participant attributes (`sipTrunkPhoneNumber`) aren't reachable by
      dynamic args. **Recommend their option (a):** stamp the dialed number into agent-dispatch
      metadata so it flows into `requestContext` natively — zero plugin change, single-agent shape
      "just works". **Optional build (b):** a post-connect `requestContext` resolver seam (await
      after connect, opt-in `waitForParticipant`, merged over `metadata.requestContext`) — only if
      they can't route the number through dispatch metadata. Steer off (c) per-call factory (the
      `agent` resolver also runs pre-connect, and it drops the single Studio-visible instance). **(M/C)**
- [x] **2 — End-of-call summary (was "flush OM at call end").** The `onCallEnd` hook they asked
      about **already shipped** (Increment 5). The core half went through two designs with the OM
      maintainer (Tyler) before landing 2026-07-06 as **one-shot summarization APIs** in
      `@mastra/memory`: `Memory.summarizeThread({ model, threadId, instructions, extract })` and
      standalone `summarizeConversation({ model, messages, ... })`. Diagnosis (Tyler): classic XY
      problem — the customer's real need is a per-call summary/extraction into THEIR storage, which
      doesn't need OM's observe/buffer/activate lifecycle at all; forcing it through OM
      (`observe({ force })`, then a buffer-path `flush()`) either broke the prompt-cache model or
      contorted OM for a non-OM job. The new APIs reuse OM's Observer + Extractor plumbing as a
      standalone call: nothing written back to memory, results go to the return value and each
      extractor's `onExtracted` hook. OM stays attached for cross-call caller facts on its own
      cadence. See Progress log. **(M / core)**
- [x] **3 — Per-tenant dynamic greeting.** Shipped 2026-07-06. `configuration.greeting.text` now
      accepts a resolver `({ metadata, requestContext, roomName, ctx }: GreetingContext) => string |
    undefined` (sync or async) in addition to a plain string, run **post-connect** so one
      multi-tenant agent can open per tenant off the dispatch metadata / request context. Resolved
      once per call (same string used for speak + persist; resolver not run twice); all #4 disclosure
      options apply to the resolved text. New exported `resolveGreetingText` helper +
      `GreetingContext`/`GreetingText` types; `speakGreeting` takes the resolved string. Pairs with #1
      (route the dialed number into `requestContext`, then greet off it). See Progress log. **(C)**
- [x] **4 — Greeting interruption protection (legal AI disclosure).** Shipped 2026-07-06 under a new
      grouped **`configuration`** worker option (`configuration.greeting.{ text, allowInterruptions,
    awaitPlayout, persist }`). The released top-level `greeting`/`persistGreeting` are kept as
      deprecated aliases (`resolveGreetingConfig` merges them, configuration wins) so the change is
      additive, not breaking.
      `allowInterruptions: false` makes the disclosure play through; `awaitPlayout: true` holds
      post-greeting work until it finishes. Extracted+tested `speakGreeting` helper;
      `GreetingConfiguration` + `LiveKitWorkerConfiguration` exported from `@mastra/livekit/worker`. See
      Progress log + the compliance-config roadmap below. **(C)**
- [x] **5 — Agent-initiated `endCall`.** Shipped 2026-07-06. `createEndCallTool` (server-safe, root
      export) is the agent-visible signal; `configuration.endCall` (`{ tool?, message?, reason?,
    maxWaitMs? }`) enables the worker-side hang-up. On each turn the worker watches `result.toolCalls`
      for the tool (composed with the user's `onTurnComplete`, de-duped), then **waits for the goodbye
      to play out** (`waitForAgentDoneSpeaking` watches `AgentStateChanged` off `thinking`/`speaking`,
      with a `maxWaitMs` cap), optionally speaks a non-interruptible `message`, then `ctx.deleteRoom()`
      (SIP hang-up) + `ctx.shutdown(reason)` (ends the job, runs `onCallEnd`). The playout wait is
      essential: teardown's `session.close()` force-interrupts speech, so hanging up before the goodbye
      drains would cut the caller off. Works on the agent AND workflow paths. See Progress log. **(C)**
- [ ] **6 — Multichannel (voice + email + WhatsApp).** Advice: share tools + workflows + memory as the
      channel-agnostic core (their finalize/validate-as-source-of-truth tool already generalizes);
      keep transport + interaction specifics per channel (channel-specific agents/entrypoints differing
      in system prompt + I/O processors — voice: terse/no-markdown/barge-in; email/WhatsApp:
      async/longer/markdown). Memory scoping generalizes: `resource` = end customer (spans channels),
      `thread` = one conversation/channel-session. **(M/C)**

### `configuration` compliance roadmap (EU AI Act & pending legislation)

`configuration` is the home for conversation & compliance policy. Greeting/AI-disclosure landed with
#4; the rest are tracked here (not stubbed as dead options). Priority order: recording →
tagTranscript → the others as demand appears.

- [x] **`greeting` / AI disclosure** — EU AI Act Art. 50(1), CA B.O.T. Act (SB 1001), Utah AI Policy
      Act, Colorado AI Act, FCC/TCPA AI-voice ruling: tell the person it's an AI at first interaction.
      Non-interruptible disclosure via `allowInterruptions:false`. **Shipped. (C)**
- [x] **`configuration.greeting.repeatEvery` / `repeatText`** — CA SB 243 (companion bots) / long
      calls: periodic AI re-disclosure. Shipped 2026-07-06: once the interval elapses, the next turn's
      spoken reply is prefixed with a short reminder (turn boundary, never mid-turn), via
      `DisclosureReminder` + `prependText` at `llmNode` — works on the agent + workflow/custom paths. **(C)**
- [x] **`configuration.requireConsent` (consent model)** — extensible, named consent set (starts with
      `summaryStorage`; `ConsentRequirement` = `true | { required, purpose }`). Shipped 2026-07-06 as
      the config/data model + surfaced on `onCallEnd` (`args.configuration`) for enforcement. NOT one
      global flag, so new items slot in as keys. **(C)**
- [x] **`requireConsent` runtime capture (`createConsentTool`)** — Shipped 2026-07-06. Server-safe
      factory exported from `@mastra/livekit`; reads the caller's `resourceId`/`threadId` from tool
      context and hands each `{ item, granted }` decision to an app-supplied `onGrant` store (app owns
      durable storage; plugin owns identity extraction + a consistent tool). `requireConsent` is now
      declare → capture → enforce end-to-end. **(C)**
- [ ] **`configuration.recording`** `{ notice }` — GDPR + two-party-consent recording states: speak a
      recording notice. Recording _consent_ becomes another `requireConsent` item. **(C)**
- [ ] **`configuration.disclosure.tagTranscript`** — EU AI Act Art. 50(2) synthetic-content labeling:
      tag persisted assistant messages as AI-generated in metadata (machine-readable). Cheap — extends
      the greeting metadata we already write. **(C)**
- [ ] **`configuration.handoff`** — EU AI Act Art. 14 human oversight: first-class "transfer to a
      human" / escalation. Sibling of the shipped `configuration.endCall` (#5) — same worker-owns-the-
      room / tool-signals-intent shape, but warm-transfer to a human instead of hang-up (LiveKit ships
      a `beta/workflows/warm_transfer`). **(C)**
- [ ] **`configuration.dataRetention`** `{ ttl, redactPII }` — GDPR Art. 17 erasure + data
      minimization: retention limits + PII redaction on the persisted thread. Needs a memory processor;
      larger. **(C/M)**
- [ ] **`configuration.limits`** `{ maxDurationMs, silenceTimeoutMs }` — safety/oversight: cap runaway
      calls. **(C)**

---

## Progress log

- **2026-06-28 — Increment 1: example rebuilt around the agent loop (verified).** The
  `examples/voice-agent` agent path now mirrors Plancraft's three scenarios + reconciliation
  with real primitives. Landed: mock-"Firebase" tenant backend + service-area (zip) check +
  deterministic end-of-call reconciliation (`src/mastra/backend.ts`); two tools
  (`checkServiceArea`, `finalizeIntake` in `src/mastra/tools/intake-tools.ts`); a
  workspace-context **input processor** that injects tenant facts each turn
  (`src/mastra/processors/workspace-context.ts`); **working memory** (Zod schema, `scope:
'resource'`) for cross-turn/cross-call field retention; explicit per-call memory scoping in
  the worker (thread=call, resource=caller); README rewrite. Typecheck green. Verified with two
  throwaway smoke runs: the deterministic backend (all six reconcile branches + in/out-of-area),
  and one live agent turn (processor injection confirmed — trades + service area are known only
  via the processor; `checkServiceArea` fires; working memory writes).
  - **Bug fixed in-flight:** the auto-generated `updateWorkingMemory` tool rejected turns with
    `serviceAreaConfirmed: expected boolean, received null` — gpt-5-mini emits `null` for
    unknown optional fields. Switched the working-memory schema from `.optional()` to
    `.nullish()`. **Possible core/docs ask:** working-memory schemas should tolerate model-emitted
    `null` for absent fields (or the docs should steer users to `.nullish()`). **(M to weigh)**
  - **Still staged (next increments):** semantic recall + observational memory (need a vector +
    embedder; W1), transcript-fidelity memory in the package (W4, the key dependency), and a
    live LiveKit end-to-end call (W6 last item).

- **2026-06-28 — Increment 2: full memory stack wired + tuned for call latency (verified).** The
  `callCenter` agent now runs three caller-scoped (`resource`) memory layers: working memory
  (structured in-call fields), **semantic recall** (`LibSQLVector` + `openai/text-embedding-3-small`,
  `topK: 3`, `scope: 'resource'`), and **observational memory** (background Observer, OpenAI model,
  `messageTokens` lowered to 1500 so it fires in a short demo). A shared `src/mastra/db.ts` points
  storage + the vector index at the same `voice-agent.db`. Verified with a throwaway smoke test:
  construction OK (all three coexist), `recall()` from a fresh thread returns prior-thread messages
  (cross-call recall), a returning caller in a new thread is greeted by name and the job recalled,
  OM is counting toward its threshold, and `updateWorkingMemory` writes with no validation errors.
  Typecheck green.
  - **Latency design (the user's ask: non-blocking working memory).** Grounded against source:
    there is **no built-in async working-memory write** and **no per-turn `onTurnComplete` hook** on
    `createLiveKitWorker`. The write is an in-loop tool call. We keep it off the caller's clock by
    (a) instructing the agent to **reply first, update memory last**, and (b) leaving
    `updateWorkingMemory` silent — because the worker streams text to TTS as it arrives, a tool call
    that trails the reply text doesn't delay what the caller hears. Recall is synchronous-before-reply
    so it's kept small (`topK: 3`); OM is genuinely background. **Residual gap → package ask in W4.**
  - **Still staged (next increments):** transcript-fidelity memory in the package (W4, the key
    dependency), the worker post-turn hook / async working-memory write (W4, see latency note above),
    and a live LiveKit end-to-end call (W6 last item).

- **2026-06-28 — Increment 3: `onTurnComplete` hook landed in `@mastra/livekit` (verified).** The
  package now exposes a per-turn post-reply hook so memory maintenance can leave the audio path
  entirely. `createAgentReplyGenerator` accumulates the turn's reply text + tool calls and, after the
  stream closes, fires `onTurnComplete({ ...turnCtx, result: { text, toolCalls, interrupted } })`
  **fire-and-forget** (not awaited; thrown hooks are caught and logged). It also fires with
  `interrupted: true` on barge-in. Plumbed through `AgentReplyGeneratorOptions` →
  `MastraVoiceAgentOptions` → `CreateLiveKitWorkerOptions`; new types (`VoiceTurnResult`,
  `VoiceTurnCompleteContext`, `VoiceTurnCompleteHook`) exported from `index.ts`. Five new
  `bridge.test.ts` cases (fires with the right context; `interrupted` on barge-in; a throwing hook
  doesn't break the turn; no fire on generation error; no fire on empty input). Full suite 57/57,
  typecheck + lint green. Changeset added (minor, additive).
  - **Example demonstration:** the agent worker's `onTurnComplete` logs each turn to a mock CRM
    contact log (`recordContact` in `backend.ts`) — a real side effect that belongs off the caller's
    clock — exercising `result.text`/`toolCalls`/`interrupted` and `memory.resource`. README's "honest
    gap" callout rewritten: the hook now exists, so the only residual is that the model still owns the
    _structured_ working-memory write in-loop. Making the hook the sole WM writer needs a read-only
    working-memory mode (new W4 box / core ask: `readOnly: true` is too broad — it also drops message
    persistence that recall + OM need).
  - **Still staged (next increments):** read-only working-memory mode so the hook can own the WM
    write (W4, core ask), transcript-fidelity memory (W4, the key dependency), and a live LiveKit
    end-to-end call (W6 last item).

- **2026-06-28 — Increment 4: workflow entrypoint brought to parity with the agent path (verified).**
  The supported workflow entrypoint no longer silently drops options the agent path supports.
  **Package (`@mastra/livekit`):**
  - **`requestContext` forwarded** into the workflow run (`createWorkflowReplyGenerator` → `run.stream`).
    Previously dropped, so steps never saw the per-session context.
  - **`onTurnComplete` + `toolFeedback` wired for the workflow/generate path.** The workflow
    generator now accumulates the turn's reply text and surfaces `tool-call` chunks from
    `workflow-step-output` (when the reply step pipes the agent's `fullStream`), then fires
    `onTurnComplete` fire-and-forget on close/barge-in — mirroring the agent generator. New
    `unwrapStepToolCall` helper (exported).
  - **`memoryInstance` worker option** resolves a `Memory` on the no-agent path so the worker
    bootstraps the call thread and persists the greeting on the workflow path (was skipped because
    `memoryInstance` was agent-only). New `resolveMemoryInstance` (exported for testing).
  - **Docs:** `VoiceTurnContext.messages` JSDoc now spells out the new-only-vs-full-transcript
    behavior for workflow / custom generators (the #5 footgun), so authors pass `ctx.messages` to a
    memory-backed step or read `chatCtx` for a stateless one.
  - **Tests:** +11 (now 68/68). `workflow-generator.test.ts`: `unwrapStepToolCall`, `requestContext`
    forwarding, `toolFeedback` from fullStream tool-calls, `onTurnComplete` fires with text/toolCalls,
    `interrupted` on barge-in, throwing-hook is logged. `worker.test.ts`: `resolveMemoryInstance`
    (agent / instance / resolver / null). Lint + `tsc --noEmit` + build all green.
  - **Example (`examples/voice-agent`):** shared `callCenterMemory` extracted to `src/mastra/memory.ts`
    so the agent and the workflow worker use one instance over one DB. `phone-conversation.ts`
    reworked: deterministic 5-intent routing (`lead`/`inspection`/`callback`/`existing_job`/`general`)
    then a memory-backed reply via the full `callCenter` agent, piping `fullStream` so tool calls
    surface. `voice-worker-workflow.ts` now sets the same caller-scoped `memory` mapping,
    `memoryInstance: callCenterMemory`, the `toolFeedback` map, and the `onTurnComplete` → `recordContact`
    CRM log. `triage` intents realigned. Verified with a throwaway generator-level smoke against real
    LLM calls: the reply streamed, `updateWorkingMemory` surfaced via `fullStream`, working memory was
    written (scenario inspection / trade roofing / zip 94103), `onTurnComplete` fired off the audio
    path, and the contact log got exactly one matching entry.
  - **Honest residual:** `onTurnComplete.toolCalls` on the workflow path only includes tool calls the
    reply step pipes through its `writer` (via `fullStream`); a step that pipes only `textStream`
    sees an empty list. Documented. The memory-stack-in-a-workflow story is intentionally scoped to
    parity-on-lifecycle + differentiation-on-determinism rather than literal 1:1 (memory is
    agent-native).

- **2026-06-28 — Increment 5: latency diagnosis + `onCallEnd` hook (OM off the critical path).**
  Live calls felt slow and observational memory appeared to block. Confirmed from the Mastra spans
  (`mastra_ai_spans`): the OM observer runs **inline** as an input-step processor (`processInputStep`
  does `await step.prepare()`), and with the agent on a **reasoning model** (gpt-5-mini), a single
  turn measured up to **57s** — ~26s of which was the OM observer's reasoning, blocking the reply.
  - **Fixes (example):** moved the agent + triage + OM observer off gpt-5-mini to a fast,
    non-reasoning model (gpt-4.1-mini — stays on `OPENAI_API_KEY`, no new env var). Measured after:
    full turn **17.9s→4.6s avg, 57s→7s max**, reasoning chunks **eliminated**, OM inline stall gone.
  - **`onCallEnd` hook (package):** new `createLiveKitWorker` option fired from LiveKit's
    `ctx.addShutdownCallback` when the call ends — off the audio path and **awaited** within the
    shutdown grace window (vs `onTurnComplete`, which is fire-and-forget). Context carries the
    memory mapping + `Memory` instance + metadata. The example flushes OM once here
    (`flushObservationalMemory` → `memory.omEngine.observe({ threadId, resourceId })`), so durable
    facts are distilled after hang-up instead of inline per turn. Types exported; worker test added
    (72/72); verified with a throwaway flush smoke. This closes the W4 "OM off the critical path"
    intent. **(C)**
  - **End-of-call summary — BUILT 2026-07-06 as `summarizeThread()` (follow-up #2).** After two
    design rounds with the OM maintainer, the end-of-call need landed as one-shot summarization
    APIs (`Memory.summarizeThread()` / `summarizeConversation()`) outside the OM lifecycle, called
    from `onCallEnd`. See the follow-up #2 progress entry below. **(M / core)**

- **2026-07-06 — Follow-up #4: greeting interruption protection, under a grouped `configuration`
  option (verified).** The opening greeting can now play through without being barged over — the
  standard need when it carries a legally required "you're speaking with an AI system" disclosure.
  Per Michael's steer, the greeting knobs were folded into a single grouped **`configuration`** worker
  option (rather than several top-level ones) so `createLiveKitWorker(...)` stays flat and future
  compliance knobs slot in without adding top-level lines.
  - **API:** `configuration.greeting.{ text, allowInterruptions, awaitPlayout, persist }`.
    `allowInterruptions: false` passes through to LiveKit's `session.say(...)` so the caller can't
    interrupt the disclosure; `awaitPlayout: true` holds greeting persistence + `onSessionStart` until
    it finishes; `persist` (default true) saves it to the thread. Replaces the top-level
    `greeting`/`greetingOptions`/`persistGreeting` (breaking, but alpha/unreleased).
  - **Helper:** exported, unit-testable `speakGreeting(session, greeting)` (same pattern as
    `buildTurnHandling`/`resolveMemoryInstance`) — builds say-options only when overriding a default
    (unset `allowInterruptions` keeps LiveKit's default), awaits playout when asked, swallows
    `waitForPlayout`'s interrupted-rejection, no-ops with no text. `GreetingConfiguration` +
    `LiveKitWorkerConfiguration` exported from `@mastra/livekit/worker`.
  - **Files:** `worker.ts` (option + types + helper + call site), `worker.test.ts` (+6 cases),
    `worker-entry.ts` (type exports), `README.md` (options table + new Configuration section), example
    `voice-worker.ts` + `voice-worker-workflow.ts` (use `configuration.greeting`).
  - **Verified:** package suite 84/84, `tsc --noEmit` + lint + `build:lib` green; example typecheck
    green against the rebuilt dist. Changeset still to add (minor). **(C)**

- **2026-07-06 — Configuration: periodic re-disclosure + extensible consent model (verified).** Two
  compliance knobs added under `configuration`, both real (not stubbed).
  - **`configuration.greeting.repeatEvery` (+ `repeatText`) — periodic AI re-disclosure.** Once the
    interval elapses, the next turn's spoken reply is prefixed with a short reminder — at the turn
    boundary, never mid-turn (CA SB 243 and similar). Implemented in `bridge.ts` as a testable
    `DisclosureReminder` (injectable clock) + `prependText` stream helper, wired at
    `MastraVoiceAgent.llmNode` so it rides the reply stream (barge-in cancellation still propagates)
    and works on the agent AND workflow/custom paths. The worker derives it from the greeting config
    and passes `greetingReminder` to the bridge; default reminder text `DEFAULT_DISCLOSURE_REMINDER`.
  - **`configuration.requireConsent` — extensible consent model.** A named consent set (starts with
    `summaryStorage`), each item `ConsentRequirement` = `true | { required, purpose }` — deliberately
    not one global "consented" flag, so new items (recording, dataSharing, …) are added as keys. The
    config _declares_ requirements and is surfaced on `onCallEnd` (`VoiceCallEndArgs.configuration`) so
    the summary-storage flush can honor them. Runtime consent _capture_ (a consent tool that records
    the caller's grant) is the tracked companion piece.
  - **Types exported** from `@mastra/livekit/worker`: `ConsentConfiguration`, `ConsentRequirement`
    (plus the existing config types).
  - **Example:** both workers set `greeting.repeatEvery: 3 * 60_000` and `requireConsent:
{ summaryStorage: true }`; `onCallEnd` gates the OM flush on `summaryStorageRequired(...)` +
    `hasSummaryConsent(...)` (mock backend consent store, defaults granted so the demo still flushes).
  - **Files:** `bridge.ts` (+ `bridge.test.ts` +7 cases), `worker.ts`, `worker-entry.ts`, `README.md`
    (Configuration section + options table), example `backend.ts` / `voice-worker.ts` /
    `voice-worker-workflow.ts`. **Verified:** package 91/91, `tsc --noEmit` + lint + `build:lib` green;
    example typecheck green. Changeset still to add (minor). **(C)**

- **2026-07-06 — `createConsentTool`: runtime consent capture (verified).** The companion to
  `configuration.requireConsent` — which only _declares_ required consents. A server-safe tool factory
  (`src/consent.ts`, exported from the root `@mastra/livekit` entry — only `@mastra/core` + zod, no
  `@livekit/agents`) so it can be added to agents defined in server/shared code. It reads the caller's
  `resourceId`/`threadId` from the tool execution context (`{ agent }` — verified against
  `AgentToolExecutionContext`) and hands each `{ item, granted }` decision to an app-supplied `onGrant`
  callback. Deliberately app-owned storage: consent lands in the app's compliant system of record, not
  an opaque plugin store; the plugin owns the hard part (identity extraction + a consistent tool +
  optional `items` enum). `requireConsent` is now **declare → capture → enforce** end-to-end.
  - **Types exported:** `ConsentGrant`, `ConsentToolOptions` from `@mastra/livekit`.
  - **Example:** `recordConsent` tool (`createConsentTool` wired to the mock backend
    `recordSummaryConsent`, restricted to `summaryStorage`) added to the `callCenter` agent + a consent
    instruction; the backend consent default flipped to **ungranted** (no consent → no summary), and
    `onCallEnd` already gates the OM flush on it.
  - **Files:** `consent.ts` (+ `consent.test.ts` +5 cases), `index.ts` + `index.test.ts` (export list),
    `README.md`, example `tools/intake-tools.ts` / `agents/call-center-agent.ts` / `backend.ts` /
    `voice-worker.ts`. **Verified:** package 96/96, `tsc --noEmit` + lint + `build:lib` green; example
    typecheck green. Changeset still to add (minor). **(C)**

- **2026-07-06 — Backwards-compat fix: greeting change made additive (verified).** The
  `configuration` refactor had _removed_ the released top-level `greeting` (string) and
  `persistGreeting` options — a breaking change to the shipped 0.1.0 API. Restored both as
  **deprecated aliases** and added `resolveGreetingConfig(options)` (exported, unit-tested), which
  merges them into the canonical `configuration.greeting` with configuration winning field-by-field.
  Existing worker configs (`greeting: '…'`, `persistGreeting: false`) keep working unchanged; the
  legacy `greeting` even composes additively with new `configuration.greeting` behavior fields (e.g.
  legacy text + `configuration.greeting.allowInterruptions`). (`greetingOptions` was never released,
  so no alias needed.) Files: `worker.ts` (deprecated options + helper + entry), `worker.test.ts` (+6
  cases), `README.md` (compat note). Package 102/102, `tsc --noEmit` + lint green. **(C)**

- **2026-07-06 — Follow-up #3: per-tenant dynamic greeting (verified).** `configuration.greeting.text`
  now takes a **resolver** in addition to a plain string, so one multi-tenant agent opens differently
  per call — the last gap for a shared worker serving many tenants.
  - **API:** `GreetingText = string | ((ctx: GreetingContext) => string | undefined | void | Promise<…>)`.
    `GreetingContext = { metadata, requestContext, roomName, ctx }` — the tenant signal is all there
    (dialed number → `requestContext` per #1, thread/resource, room). Additive: a plain string still
    works; the resolver is opt-in.
  - **Semantics:** invoked **post-connect** (after `ctx.connect()` + `session.start()`), so the
    resolved request context is available. Resolved **once per call**; the same resolved string feeds
    both `session.say` and greeting persistence, so a resolver with side effects isn't run twice.
    Empty/`undefined` result → no greeting. All #4 disclosure options (`allowInterruptions`,
    `awaitPlayout`, `repeatEvery`, `persist`) apply to whatever it returns.
  - **Implementation:** new exported, unit-tested `resolveGreetingText(text, context)` (mirrors
    `resolveGreetingConfig`); `speakGreeting` now takes the already-resolved string (internal
    `ResolvedGreetingConfiguration`); the entry resolves once and threads it to speak + persist.
    `GreetingContext`/`GreetingText` exported from `@mastra/livekit/worker`.
  - **Files:** `worker.ts` (types + `resolveGreetingText` + `speakGreeting` signature + entry),
    `worker.test.ts` (+5 `resolveGreetingText` cases), `worker-entry.ts` (type exports), `README.md`
    ("Per-tenant greeting" note + options table), example `voice-worker.ts` (comment; demo stays
    single-tenant). **Verified:** package 107/107, `tsc --noEmit` + lint + `build:lib` green; example
    typecheck green against the rebuilt dist. Changeset still to add (minor). **(C)**

- **2026-07-06 — Follow-up #5: agent-initiated `endCall` (verified).** The agent can now end the call
  itself (say goodbye → hang up) — the biggest of the design pieces, because the tool that triggers it
  runs inside `agent.stream()` with no handle to the room, and the playout timing is a trap.
  - **The trap:** `onTurnComplete` fires at text→TTS, before the goodbye plays out; the job teardown's
    `session.close()` force-interrupts speech (confirmed reading `@livekit/agents`
    `job_proc_lazy_main`: `ctx.shutdown()` → `session.close()` (force) → shutdown callbacks). So a
    naive "hang up when the tool fires" cuts the caller off mid-goodbye.
  - **Shape:** `createEndCallTool` (server-safe, root export, mirrors `createConsentTool`) is the
    agent-visible signal — returns `{ ended: true }` + optional `onEndCall` bookkeeping with the caller
    identity; it does NOT touch the room. `configuration.endCall` (`{ tool?, message?, reason?,
maxWaitMs? }`) enables the worker-side hang-up. Keeping the trigger a tool inside the single agent
    keeps it Studio-visible and instruction-driven.
  - **Worker wiring:** a turn-complete detector (composed with the user's `onTurnComplete`, de-duped)
    watches `result.toolCalls` for the tool. On a hit: `waitForAgentDoneSpeaking` (watches
    `AgentStateChanged` until state leaves `thinking`/`speaking`, `maxWaitMs` safety cap) → optional
    non-interruptible `message` → `ctx.deleteRoom()` (SIP hang-up) + `ctx.shutdown(reason)` (ends the
    job, runs `onCallEnd`). deleteRoom + shutdown run in a `finally`, so a hiccup while waiting still
    ends the call. Works on the agent AND workflow paths (rides `result.toolCalls`). Helpers exported
    - unit-tested.
  - **Files:** `end-call.ts` (new) + `end-call.test.ts` (+5), `worker.ts` (`EndCallConfiguration` +
    `waitForAgentDoneSpeaking` + `runEndCall` + detector + entry) + `worker.test.ts` (+9), `index.ts` +
    `index.test.ts` (export), `worker-entry.ts` (type export), `README.md`, example
    `tools/intake-tools.ts` (endCall tool) / `agents/call-center-agent.ts` (tool + goodbye→endCall
    instruction) / `voice-worker.ts` + `voice-worker-workflow.ts` (`endCall: {}`). **Verified:** package
    121/121, `tsc --noEmit` + lint + `build:lib` green; example typecheck green against the rebuilt
    dist. Changeset still to add (minor). **(C)**

- **2026-07-06 — Follow-up #2: end-of-call summary, landed as one-shot summarization APIs after
  two design rounds with the OM maintainer (Tyler).**
  - **Design history.** (1) First shipped as `observe({ force: true })` — rejected: force-ACTIVATES
    (breaks OM's prompt-cache model, trims rich recent context), double-observes (`observe()`
    doesn't exclude already-buffered messages while `buffer()` does), races in-flight background
    buffering (different lock domains). (2) Reworked to a buffer-path `ObservationalMemory.flush()`
    (awaitable final buffering pass, no activation) — sound OM mechanics, but Tyler's second pass
    reframed the whole thing as an XY problem: the customer only needs a per-call
    summary/extraction into THEIR storage; that job doesn't need OM attached to the agent, and
    extractors can't do it alone anyway (extraction only sees the chunk being observed + ~2k
    tokens of prior observations, and idle-buffering fires per turn, not per call). (3) Final: a
    small official API exposing "the summarization/extraction logic OM happens to have".
  - **New shape (core, `@mastra/memory`):** standalone `summarizeConversation({ model, messages,
    instructions?, extract?, threadId?, resourceId?, ... })` in
    `processors/observational-memory/summarize.ts` — drives `ObserverRunner` one-shot (same
    distillation prompt, parsing, degenerate retry, structured-extraction follow-up), then
    `applyExtractorHooks` (each Extractor's `onExtracted` fires with threadId/resourceId). Returns
    `{ summary, extracted, extractionFailures?, usage? }`. Nothing read from or written to OM
    records/storage. Plus `Memory.summarizeThread({ model, threadId, resourceId?, ... })` — loads
    the thread via `recall(perPage: false)` and delegates; works whether or not OM is enabled.
    Both exported from the root entry (with `SummarizeConversationOptions/Result`, `SummarizeModel`
    types). The earlier `observe({ force })` and `flush()` designs were fully reverted (never
    released) — OM engine + API tests are byte-identical to main.
  - **Finding (smoke, 2026-07-06): async buffering is NOT supported with `scope: 'resource'`**
    (`validateBufferConfig` throws on explicit config; silently disabled otherwise) — so the
    example's caller-scoped OM runs SYNCHRONOUSLY: the observer fires inline at the
    `messageTokens` threshold (the Increment-5 stall), mitigated by a fast observer model +
    threshold sizing. This retroactively validates the summarize direction: the buffer-path
    `flush()` AND Tyler's `bufferOnIdle` suggestion would both have been unusable for Plancraft's
    resource-scoped setup. An `activateAfterIdle: 'auto'` addition to the example was removed as
    inert (nothing is ever buffered); comments now document the sync reality.
  - **Example:** OM stays attached for cross-call caller facts (sync, threshold-gated, per the
    finding above). New consent-gated `summarizeCall` helper in `memory.ts`: `summarizeThread`
    + a schema-backed `call-summary` Extractor (`summary`, `sentiment`, `requestedServices`) whose
    `onExtracted` writes to the new mock-backend `callRecords` store (`saveCallSummary`) —
    `metadataKeyPath: false`, so the business owns the record end to end. All three workers'
    `onCallEnd` now call it (agent, workflow, regulated).
  - **Files (core):** `summarize.ts` (new) + `__tests__/summarize.test.ts` (6 cases: summary
    output, custom instructions reach the system prompt, inline extractor + `onExtracted`
    identity, structured extractor via follow-up call, empty-messages no-op without model call,
    `Memory.summarizeThread` storage round-trip), OM barrel + root `index.ts` exports,
    `Memory.summarizeThread` method; docs: new `reference/memory/summarizeThread.mdx` + sidebar
    entry (OM reference page restored to main); changeset rewritten (`@mastra/memory` minor).
  - **Files (example/livekit):** example `memory.ts` (extractor + `summarizeCall`, OM comment),
    `backend.ts` (`CallSummaryRecord`/`callRecords`/`saveCallSummary`), `voice-worker.ts` /
    `voice-worker-workflow.ts` / `voice-worker-regulated.ts` (`onCallEnd` → `summarizeCall`),
    `README.md` (lifecycle bullet + `onCallEnd` snippet now `summarizeThread`). **(M / core)**

---

## Guiding principles

- Agent-first; stay as close to Mastra primitives as possible (agent, memory, processors, tools).
- The workflow entrypoint stays; it just isn't the focus.
- The `voice-agent` example must **simulate Plancraft's workflow scenarios as closely as
  possible** with the agent primitive, and be **runnable + referenceable** by them.
- Memory must be trustworthy under barge-in (persist what was _spoken_, not what was generated).

---

## Workstream 1 — Memory & context (agent-native) `P1`

The stated "key" requirement: semantic recall, memory, context.

- [x] Scope memory `thread = call`, `resource = caller`, so calls for a caller share recall.
      Worker resolver in the example; `scope: 'resource'` working memory. **(C/M)**
- [x] Enable **semantic recall** of prior conversations across calls. `LibSQLVector` index in the
      shared `voice-agent.db` + `openai/text-embedding-3-small`; `topK: 3`, `scope: 'resource'`.
      Tuned small because recall is synchronous-before-reply. **(C)**
- [x] Use **Observational Memory** at the caller resource to accumulate durable facts across calls
      and inject them into each call. Background Observer (OpenAI model here; route to a fast model
      like Gemini Flash in production), `messageTokens` lowered to 1500 so it fires in a short demo. **(C)**
- [x] Use **working memory** for in-call captured fields (address, zip, trade, name, number) so
      they survive across turns without bespoke state. Zod schema, `scope: 'resource'`. **(C)**
- [ ] Define population precedence when Observational Memory and the third-party API disagree
      (e.g. service area) — see open questions. **(M/PC)**

## Workstream 2 — Agent determinism via Processors `P1`

Make the agent loop deterministic where it matters, without leaving the primitive.

- [x] **Input processor:** resolve domain/tenant (mock Firebase) and inject workspace context each
      turn (`workspace-context.ts`). Recalled-memory injection is handled by working memory, not
      this processor. **(C)**
- [ ] **Input processor:** deterministic **scenario routing** (lead / inspection-intake /
      callback) that sets instructions + the allowed tool set per scenario. Currently the agent
      routes via instructions (scenarios are discovered mid-call); processor-based routing is
      gated on the Plancraft open question (known-at-start vs mid-call). **(C)**
- [x] Validate zip / service-area before promising a visit — implemented as the `checkServiceArea`
      tool plus a deterministic re-check inside reconciliation (never trusts the conversation
      alone), rather than a pre-reply processor. **(C)**
- [ ] **Output processor:** structure/validate the reply for voice (no markdown/lists, etc.).
      Currently enforced via instructions. **(C)**
- [x] **Reconciliation merge** (collected fields → backend) — implemented as the `finalizeIntake`
      tool → `reconcileIntake`, a single deterministic end-of-call pass. (A per-turn output
      processor doesn't fit end-of-call; a tool is the agent-native fit.) **(C)**
- [ ] Evaluate determinism levers on `Agent`: structured outputs, forced/required tool calls,
      per-scenario scoped toolsets. **(C/M)**
- [ ] Capture any **core `@mastra/core` ask** this surfaces (e.g. a deterministic "trigger this
      tool on this turn" hook). **(M)**

## Workstream 3 — Third-party data integration `P1`

- [x] **Firebase direct call** to resolve the domain/tenant for the call — mock `resolveWorkspace`/
      `getWorkspace` keyed by dialed number, with default-tenant fallback. **(C/M)**
- [x] **Zip / service-area validation** call — mock `checkServiceArea` with zip normalization. **(C)**
- [ ] Caching, timeouts, and graceful fallback (what the assistant says if a lookup fails) —
      fallback done (default tenant); caching/timeouts pending real backends. **(C)**

## Workstream 4 — Integration (package) work for the agent loop `P1`

- [ ] Make **turn-boundary → agent turn + barge-in** first-class and robust; document that LiveKit
      owns turn/EOU detection and the package wires it (answers "can turn detection be built into
      the workflow" → no, but the package makes it automatic). **(C)**
- [ ] **Transcript-fidelity memory (was Phase 2):** persist the _actually spoken / interrupted_
      transcript, not the generated text, so recall is trustworthy under barge-in. Now a
      dependency of Workstream 1. **(C)**
- [ ] First-class **processor support** in `createLiveKitWorker` (or document the agent-level
      processor path clearly). **(C)**
- [x] **Per-turn `onTurnComplete` hook** on `createLiveKitWorker` (fired after the reply streams,
      off the audio path) so memory maintenance can be fully backgrounded. Landed in Increment 3:
      `onTurnComplete(ctx)` fires fire-and-forget after the reply streams (the worker never awaits
      it), carrying the produced reply (`result.text`/`toolCalls`/`interrupted`) and the resolved
      `memory` mapping; a thrown hook is logged, not propagated. Also fires with `interrupted: true`
      on barge-in for reconciliation. The example worker uses it to log each turn to the CRM
      (`recordContact`), off the caller's clock. Tests in `bridge.test.ts`. **(C)**
- [x] **Read-only working-memory mode** (the sole-writer follow-on surfaced by the hook) —
      **RESOLVED 2026-07-07: the core ask already shipped.** `workingMemory.agentManaged: false`
      suppresses the in-loop tool AND the "update immediately / every response" system instruction
      while keeping working memory injected as read-only context (scoped exactly right — message
      persistence untouched, so recall + OM keep working). The example now uses it
      (`examples/voice-agent/src/mastra/memory.ts`) with a `WorkingMemoryExtractor` on
      `summarizeCall`, so the caller's fields land once at call end. Instruction-level mitigations
      removed from both example agents, and both agents got a `defaultOptions.stopWhen` hard stop
      on `endCall` (the model structurally cannot speak past its goodbye).
      **Two @mastra/memory bugs found while wiring the fuller form (file separately, draft in
      `om-working-memory-extractor-bugs-draft.md`):** (1) `observation.manageWorkingMemory: true`
      crashes with resource-scoped working memory — `ObserverRunner.callMultiThread` guesses
      `resourceId` from the first message row (`observer-runner.ts:409`) instead of taking it from
      the resource-scoped strategy, and `getWorkingMemory` throws when the guess comes up empty;
      (2) `WorkingMemoryExtractor`'s generic schema (`z.union([z.record(...), z.null()])`) compiles
      to JSON Schema with `propertyNames`, which OpenAI structured outputs rejects (400) — it
      self-heals via retry but logs a loud upstream error on every extraction. Once (1) lands,
      switch the example to `manageWorkingMemory: true` so mid-call Observer fires also update WM.
  - **Evidence trail:** 2026-07-06 live regulated call — in-loop WM writes cause DOUBLE-SPEAK
    (model re-states its reply after the tool result; bridge streams every delta to TTS).
    2026-07-07 live plugin-worker call — same echo on 2 of 7 turns, plus a turn where the WM write
    ran BEFORE the reply (3.85s dead air), plus ~2x prompt tokens on every memory-writing turn.
    The injected WM system instruction ("call updateWorkingMemory immediately … in every
    response") directly fights any reply-first prompt, which is why instruction-level fixes kept
    losing.
- [ ] Sensible **memory defaults** for the agent worker (thread/resource mapping, greeting
      persistence). **(C)**

## Workstream 5 — Model & speech stack alignment `P1`

- [ ] **STT: AssemblyAI Universal-Streaming ("RT Pro")** — confirm a LiveKit plugin exists / wire
      it as the `stt` option. **(C/M)**
- [ ] **Models: Gemini Flash + Gemini Pro** — confirm Google/Gemini routing in the voice path;
      route Flash for fast turns, Pro for reasoning + reconciliation. **(C)**
- [ ] **Turn detection: LiveKit multilingual** — already supported; verify end-to-end with the
      AssemblyAI STT + Gemini models. **(C)**

## Workstream 6 — `examples/voice-agent` rebuild (the reference for Plancraft) `P1`

Reproduce the workflow scenarios with the agent primitive so they have a runnable reference.

- [x] **Scenario A — lead for a tradesperson:** qualify + capture the lead. **(C)**
- [x] **Scenario B — inspection intake:** capture address for a roof inspection, then run the
      **service-area check** ("are you in my service area?") via zip validation. **(C)**
- [x] **Scenario C — general callback:** capture name + number. **(C)**
- [x] **Reconciliation step at call end** merging everything collected, in one deterministic pass
      (`finalizeIntake` → `reconcileIntake`). **(C)**
- [x] Wire in **semantic recall + observational memory + working memory** — all three layers wired,
      caller-scoped, and tuned for call latency (Increment 2). **(C)**
- [x] Wire the **Firebase / zip-validation** data calls (mock backend). **(C)**
- [x] Keep the existing **workflow worker** in the example (entrypoint stays supported); the
      **agent worker is the primary, richer path** (four scenarios + reconciliation + memory). **(C)**
- [ ] Verify the example runs end-to-end against **LiveKit Cloud** and persists threads to the
      Studio it's viewed in (single worker, unique agent name). Agent-level turns verified via
      direct `generate`; live call still pending. **(C/M)**

## Workstream 7 — Docs, changeset, packaging `P2`

- [ ] Update `docs/voice/livekit.mdx` + `reference/voice/livekit.mdx` for the agent-loop +
      processors + memory story. **(C)**
- [x] Update `integrations/livekit/README.md` — full rewrite for the current state: both entrypoints,
      the complete `createLiveKitWorker` options table, the three lifecycle hooks, `liveKitConnectionRoute`
      / `runLiveKitWorker` options, and a "Runnable example" section pointing at `examples/voice-agent`
      with monorepo setup steps. Example README updated for the workflow parity (Increment 4). **(C)**
- [ ] Fold this decision + the agent-first direction into `integrations/livekit/docs/`. **(C)**
- [x] Changeset (minor — additive). `.changeset/blue-bears-pump.md` covers the per-turn hooks +
      workflow-entrypoint parity. **(C)**

## Workstream 8 — Workflow entrypoint parity `P1`

Bring the supported workflow entrypoint to feature parity with the now-fleshed-out agent path,
without making it the focus. Differentiation is determinism (explicit routing), not memory depth.

- [x] **Forward `requestContext`** into the workflow run (was dropped). **(C)**
- [x] **`onTurnComplete` on the workflow path** — generator accumulates reply text + surfaces tool
      calls, fires fire-and-forget on close/barge-in. **(C)**
- [x] **`toolFeedback` on the workflow path** — fires for tool calls the reply step pipes via
      `fullStream`; `unwrapStepToolCall` added. **(C)**
- [x] **`memoryInstance` worker option** — bootstrap the call thread + persist the greeting on the
      no-agent path (`resolveMemoryInstance`). **(C)**
- [x] **Document `ctx.messages`** new-only-vs-full behavior for workflow / custom generators. **(C)**
- [x] **Example workflow worker at parity** — shared `callCenterMemory`, deterministic 5-intent
      routing, memory-backed reply (`fullStream`), `toolFeedback` + `onTurnComplete` CRM log. **(C)**
- [x] **Make in-step tool-call surfacing reliable.** A step's `writer` is the only channel into
      the workflow stream and an inner `agent.stream()`'s tool calls don't bubble up on their own,
      so surfacing requires the step to write them. Shipped `pipeAgentReplyToWriter(agentStream,
    writer)` (exported): forwards text deltas + `tool-call` chunks (filtering the rest), returns
      the spoken text — a one-liner that removes the `textStream`-drops-tool-calls footgun. The
      example reply step uses it; the `textStream` limitation is documented on the helper, the
      generator, and the worker `toolFeedback` option. Verified with a real-LLM smoke (tool call
      surfaced through the helper → `onTurnComplete.toolCalls` → CRM log). **(C)**
- [ ] **Verify the workflow worker live against LiveKit Cloud** (generator-level smoke passed; live
      audio call pending, same as W6). **(C/M)**

---

## Milestones & sequence

1. **M1 — Foundations:** Workstream 1 (memory scoping + recall) + Workstream 4 (transcript
   fidelity, processor support).
2. **M2 — Determinism + data:** Workstreams 2 and 3 (processors, Firebase, zip validation).
3. **M3 — Example:** Workstream 6 (the 3 scenarios + reconciliation, runnable reference).
4. **M4 — Stack + docs:** Workstreams 5 and 7.

Rough order: M1 → M2 → M3 → M4. The example (M3) is the deliverable Plancraft references, so pull
it forward as soon as M1/M2 primitives exist.

## Open questions for Plancraft

- [ ] Is durable cross-process resume actually needed, or just linear authoring? (Confirms we were
      right to drop suspend/resume.) **(PC)**
- [ ] Is the 3-way scenario split known at call start (routable deterministically) or discovered
      mid-call? **(PC)**
- [ ] Source-of-truth precedence when Observational Memory and Firebase disagree (e.g. service
      area)? **(PC)**
- [ ] Exact Firebase shape for domain resolution + the zip/service-area validation contract. **(PC)**

## Risks

- Memory fidelity under barge-in (generated ≠ spoken) blocks trustworthy recall — Workstream 4
  transcript fidelity is the dependency.
- AssemblyAI / Gemini gaps in the LiveKit path found late — verify early in Workstream 5.
- Determinism via processors may surface a real `@mastra/core` gap (forced tool triggering) —
  track as a core ask, don't fork behavior into the integration.

---

## Already done (context — Phase 1)

- [x] Workflow entrypoint: `createWorkflowReplyGenerator`, worker `workflow`/`workflowInput`/
      `replyStep`/`resultText`/`generate` options, reply-generator seam in `bridge.ts`.
- [x] Tests, docs (guide + reference), README, changeset.
- [x] `examples/voice-agent` rebranded to a trades contractor with both agent and workflow
      workers.
- [x] Design doc: `integrations/livekit/docs/workflow-entrypoint-design.md`.
