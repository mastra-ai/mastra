# LiveKit transcript persistence with Mastra Memory

**Status:** Implemented; PostgreSQL verified; controlled voice-call check pending

**Date:** October 13, 2026  
**Package:** `@mastra/livekit`  
**Audience:** Mastra maintainers and integration developers

## Approved implementation adjustments

The user approved these adjustments on October 13, 2026:

- Keep persistence off the audio path. A new generation waits only for preceding unfinished writes, accepting storage-dependent delay to preserve context correctness.
- Preserve the native timestamp in message metadata and adjust the stored ordering timestamp where needed for stable Memory ordering.

The adapter passes native text through the existing Memory API. Memory retains its own normalization behavior, including whitespace and working-memory-tag removal.

## Proposal

Add an opt-in adapter that saves LiveKit's committed conversation into Mastra Memory. LiveKit determines which conversation items belong in its history; the adapter converts those items into Mastra messages and saves them in the session's existing memory thread.

The result should be a saved conversation containing the caller's committed transcript, the agent's greeting, and the agent's committed replies, with interruption information. Discarded response drafts must not become spoken transcript entries. Subsequent agent turns must retain the memory context and tool information they need.

Keep the implementation in `@mastra/livekit`, including support for workers that call a remote Mastra server. Reuse LiveKit events and types, Mastra Memory, and the existing authenticated Memory API. No changes to `@mastra/core`, `@mastra/memory`, `@mastra/server`, or storage packages are planned. Any missing capability in those packages requires a separate scope decision.

This is the second step after the shared session contract. That contract remains unchanged; enabling transcript persistence is a worker/application decision, not an instruction accepted automatically from dispatch metadata.

## Problem and user value

Generating an answer and speaking it are different events. An agent can produce a complete answer, speak only part of it, and then be interrupted. LiveKit can also request a speculative answer that is discarded before playback. Automatic persistence of generated output can therefore put unsaid text into the saved conversation.

Applications currently have to coordinate LiveKit events, Mastra's memory settings, message conversion, duplicate handling, greetings, and shutdown themselves. A shared adapter can replace this repeated integration work while preserving application-specific lifecycle behavior.

The adapter should let an application remove that transcript-specific plumbing while continuing to use its existing Memory implementation, thread identities, authentication, and transcript readers.

“Committed transcript” means the text LiveKit places in conversation history. It does not mean an independently verified, word-perfect record of what a remote person heard. The adapter must not infer playback completion from generation completion or implement its own speech alignment.

## Success criteria

- One saved transcript message per committed LiveKit message identity, including after a retry whose original response was lost.
- No spoken transcript rows created solely from discarded generation output.
- An interrupted reply retains LiveKit's supplied text and interruption flag.
- Existing memory history remains readable during generation, and each subsequent turn sees the committed conversation without duplicate inputs.
- The same persistence semantics work with a local Mastra agent and with `MastraLLM` calling a remote Mastra server.
- Existing users see no change until they explicitly enable the feature.
- Applications can remove overlapping conversation-item ingestion and persistence code after adoption, while retaining business-specific lifecycle handling.

## Release scope

| Included | Outside this release |
| --- | --- |
| User and assistant transcript persistence through Mastra Memory | Audio recording, retranscription, or custom speech alignment |
| Greeting and interruption handling | Phone dialing, DTMF, inactivity timers, and call-duration policies |
| Stable message identity, ordered writes, and graceful shutdown flushing | Durable event queues, crash recovery services, and guaranteed business callbacks |
| Read-only generation with existing memory reads | New memory engines, tables, storage interfaces, or call records |
| Preservation of supported Mastra tool calls and results as structured memory content | Re-executing tools, inferring missing tool results, or changing tool side-effect semantics |
| Local worker integration and remote persistence through existing APIs | Automatic support for arbitrary workflows or custom reply generators that write their own history |

The supported initial generation paths are `createLiveKitWorker()` using a Mastra agent, and a custom LiveKit session using `MastraLLM` with its local-agent or remote-agent source. Custom generators remain usable through their existing APIs, but cannot silently opt into managed persistence without supplying the required integration points.

## Existing capabilities to reuse

- LiveKit's `AgentSessionEventTypes.ConversationItemAdded` and native `ChatMessage` properties provide committed items, identity, text, timestamps, and interruption information. Filter out non-message items such as handoffs. See [LiveKit's event documentation](https://docs.livekit.io/reference/agents/events/#conversation_item_added).
- Mastra's per-run `memory.options.readOnly` supports reading memory without automatic message persistence. The integration already forwards this option through its local and remote generation paths.
- Mastra Memory already provides `getThreadById`, `createThread`, and `saveMessages`. Use these methods rather than writing directly to a database or storage adapter.
- `MastraClient.saveMessageToMemory()` calls the existing authenticated `/memory/save-messages` endpoint. Existing thread APIs provide remote thread lookup and creation. Prefer this client and its transport behavior to a new lifecycle endpoint or HTTP client.
- The integration already has greeting persistence, playback observation, generation identifiers, and cancellation handling. Coordinate these paths instead of adding a second independent writer.

The package's server-safe entry must remain free of LiveKit worker runtime imports. Session listeners belong in the worker entry. Remote client loading must preserve existing optional-dependency behavior.

## Intended developer experience

The built-in worker should expose one explicit opt-in using its existing resolved agent, Memory instance, thread, and resource. A proposed shape is:

```typescript
import { createLiveKitWorker } from '@mastra/livekit/worker';
import { mastra } from './index';

export default createLiveKitWorker({
  mastra,
  agent: 'support',
  transcriptPersistence: 'memory',
});
```

`transcriptPersistence` is the approved worker option. Custom sessions use `createLiveKitTranscriptPersistence()` shared with `MastraLLM`. Omission retains today's behavior. The feature must not turn on preemptive generation or change speech settings.

For a custom session, provide an explicit adapter binding shared by `MastraLLM` and the LiveKit session. It must coordinate both generation and persistence; attaching an event listener alone is insufficient. The binding accepts either the resolved local Memory instance or an existing configured Mastra client for remote access, plus the same trusted agent/thread/resource identity used for generation. It exposes an awaitable flush and finalization operation.

Document the complete custom-worker setup, including attachment before session start, read-only generation, and shutdown. Detect conflicting persistence settings and duplicate attachment rather than silently running two writers. Missing Memory or unsupported generation sources should fail during setup, before the greeting or first reply.

## Required behavior

### 1. Establish one persistence owner

When enabled, the adapter owns persistence of supported conversational messages. Generation must use the resolved thread and resource with `memory.options.readOnly: true`, preserving other compatible memory options. Do not substitute `memory: false`: that selects a different history-supply path in the existing integration.

An explicit conflicting write configuration must produce a configuration error. Arbitrary custom processors and application tools can have their own writes; document that boundary and do not claim that read-only generation prevents business side effects.

The existing worker greeting writer must be bypassed in this mode. Greetings committed by LiveKit use the same persistence path as other assistant messages. Existing greeting settings retain their behavior when this feature is off. Any explicit existing opt-out of greeting persistence needs a tested, documented interaction with the new mode; do not silently override it.

### 2. Consume committed conversation items

Attach before starting the session or speaking the greeting. Snapshot accepted native events into immutable persistence work so later mutation of a LiveKit object cannot change a queued write.

Persist user and assistant textual content from committed `ChatMessage` items. Skip empty or whitespace-only text without storing a placeholder. Preserve the supplied non-empty text without trimming or reconstructing its spoken extent. System instructions, handoff records, raw audio, and image payloads do not become transcript text.

Use LiveKit's committed item text for both completed and interrupted replies. Do not use `onTurnComplete`, LLM text deltas, or a generic final-transcription notification as proof that an assistant message belongs in the spoken transcript. Account for supported native resumption or correction behavior using LiveKit's public history/events, not a heuristic based on a cancelled generation.

### 3. Save standard Mastra messages

| Stored field | Requirement |
| --- | --- |
| Message ID | Deterministic identity derived from the bound thread, existing LiveKit job/session identity, and native item ID. Preserve the mapping across delivery retries. |
| Role and content | Standard Mastra user/assistant message with a text part; structured tool content follows the separate tool requirements below. |
| Thread and resource | Use the trusted session binding, never values inferred from transcript text or phone numbers. |
| Timestamp | Preserve the native item timestamp using the installed SDK's units. Use receipt time only when the timestamp is absent, and retain that choice across retries. |
| Metadata | Record source `livekit`, native item ID, job/session identity, interruption state, and per-session ordering information. Do not copy arbitrary native `extra` fields or credentials. |

Use an existing thread when supplied. Create a missing thread through Memory, without replacing the title, metadata, or ownership of an existing one. Reject an ownership mismatch. Repeated creates must safely handle an already-created thread belonging to the expected resource.

The persisted ID and the ID used when that item is supplied to generation must agree. A namespace added only to stored messages would defeat deduplication between current input and recalled history.

### 4. Handle repeats and ordering

Serialize writes within the adapter's session. Repeated delivery of the same immutable item must address the same stored message. Verify the required save/upsert semantics against real Memory storage; an in-memory set is not a cross-process guarantee.

Retries must reuse the original item snapshot, timestamp, and identity. If a supported LiveKit lifecycle can revise a committed item, define and test the revision order so an older retry cannot replace newer content. If public APIs cannot provide a safe revision boundary, report that as a design blocker instead of inventing one.

Preserve native chronology when items share timestamps or writes are retried. Metadata containing a sequence number is not enough if existing Memory readers display a different order; verify ordering through the same recall APIs used by the agent and transcript readers.

The first release assumes one active transcript writer for a thread. Sequential sessions may reuse a thread, but cross-session deduplication requires retaining the original native identities. Concurrent active calls writing the same thread are not a supported ordering guarantee.

### 5. Keep subsequent turns correct

Before starting another generation, await the writes already queued for preceding committed context. Do not wait for the assistant response that the new generation itself will produce. This boundary must work with speculative generation and must not deadlock on an event LiveKit emits later.

The next request must include the current user input exactly once, whether it was already committed and saved or is still being considered speculatively. Reconcile persisted IDs with the input messages rather than appending full LiveKit history on top of Memory history.

The integration currently resends the last interrupted assistant fragment on the next turn. In managed persistence mode, coordinate that behavior with the adapter so it cannot duplicate or overwrite an already-saved fragment. Leave the legacy behavior unchanged outside this mode.

LiveKit event callbacks must not synchronously wait for storage or block audio playback. Waiting for consistency may delay the next generation; measure that delay and surface storage failures rather than claiming persistence adds no latency.

### 6. Preserve tool context separately from spoken text

Mastra tools execute inside the Mastra agent. LiveKit's conversation-item events are not a complete record of those calls. The current bridge observes tool-call chunks and uses tool-result chunks for metrics, but its completion hook does not expose a complete result history.

Use existing public Mastra stream data to retain supported tool call IDs, arguments, results, errors, and their association with a generation attempt. Save them using standard structured Mastra message parts, separate from the spoken transcript text. Do not label a tool result as something the agent said.

Discarding speech must not erase a tool action that actually executed. Conversely, do not invent a result for a cancelled or incomplete call. Replaying a persistence write must never re-execute the tool. Cross-turn recall must preserve valid tool-call/result relationships without introducing orphan results or duplicate calls.

This is a release gate for agents using tools. If public stream APIs cannot support it without a core change, bring the limitation back for a scope decision. Do not ship a general “memory-compatible” claim while silently dropping tool context.

### 7. Support remote workers without a new ingestion service

Map the same committed items to standard Mastra messages in the integration, then use the existing Mastra client to look up/create threads and save messages remotely. Carry the configured authentication, request context, agent selection, and API prefix through these calls. Storage configuration and credentials stay on the Mastra server.

Confirm that generation and persistence resolve the same Memory configuration, including agents whose memory depends on request context. The current save endpoint uses its existing configuration behavior; do not assume it reproduces every per-run Memory override. Unsupported combinations must be identified in the compatibility matrix or brought back for a separate decision.

Use existing server authorization and thread ownership checks. Remote opt-in requires credentials allowed to write the selected memory resource. A permission failure must not fall back to another thread, resource, or unauthenticated endpoint. No new credential or authorization mechanism is proposed.

### 8. Report failures and finalize honestly

Reuse the Mastra client's bounded retry behavior for remote writes. Keep failed work identifiable within the live adapter, with an error result that distinguishes saved, pending, and failed items. Do not add a durable queue or promise recovery after process termination.

Expose persistence errors through the integration's logger and an optional observer. Logs contain identifiers and error categories, not transcript text by default. A failed write must not be reported as saved merely because it was queued.

The default consistency policy is to fail the next generation's persistence barrier if preceding required writes remain unsuccessful. It must not silently continue with stale Memory or re-enable ordinary generation writes. This does not itself hang up the call; existing application/LiveKit error handling remains responsible for that choice.

On graceful shutdown, let LiveKit finalize the session's conversation items, then flush accepted work before detaching listeners and running transcript-dependent completion hooks. Bound that wait by the configured shutdown budget. On failure or expiry, report incomplete persistence. A process crash may lose unacknowledged items; successfully saved items retain the storage provider's durability guarantees.

## Compatibility and Memory effects

The default remains unchanged: no listeners, read-only overrides, extra writes, or remote requests without opt-in. Existing hooks, imports, dispatch metadata, and session settings remain valid. Enabling the feature must not rewrite existing threads or delete historical messages.

Using `Memory.saveMessages()` preserves the configured Memory implementation's save behavior, including any configured indexing work. It is not equivalent to running the entire agent memory pipeline. Read-only generation also affects working-memory tools and other write-oriented processors. Validate and document message history, semantic recall, working memory, and observational memory separately; do not promise automatic updates to all four merely because transcript messages were saved.

The shared session contract introduced earlier does not need a new version for a worker-only opt-in. No schema should accept storage credentials or let untrusted metadata enable persistence for an arbitrary resource.

## Acceptance tests

| Scenario | Required result |
| --- | --- |
| Feature omitted | Existing worker, greeting, memory, and remote behavior is unchanged. |
| Normal two-turn conversation | Committed user and assistant messages appear once, in order, through Memory recall. |
| Greeting | One committed greeting message, including the native interrupted form when applicable. |
| Speculative draft discarded before commitment | No spoken transcript entry for that draft. |
| Interrupted reply and immediate next turn | Native partial text and interruption state saved once; next prompt has the correct context once. |
| Duplicate event or lost HTTP acknowledgement | Retrying produces one stored message with stable identity and timestamp. |
| Native resumption/correction | Final stored content follows the verified SDK lifecycle; stale retry cannot regress it. |
| Equal timestamps and delayed writes | Recall and transcript display retain the required conversation order. |
| Tool completes, then speech is interrupted | Confirmed tool call/result remains structured history; unheard reply text is absent. |
| Cancelled or failed tool | No fabricated result, tool replay, or invalid call/result pairing. |
| Existing thread or replayed session setup | Ownership, existing messages, title, and unrelated metadata are preserved. |
| Invalid binding or unauthorized remote write | Explicit setup/write error; no fallback to another resource. |
| Storage unavailable or remote retry exhausted | Error and incomplete state are visible; next generation does not silently read stale context. |
| Graceful shutdown with pending final items | Final items drain before transcript-dependent completion hooks, or an incomplete result is reported. |
| Local versus remote execution | Equivalent saved messages, context behavior, and error semantics. |
| Memory feature combinations | Supported history/recall behavior verified; write-oriented feature limitations documented. |

Use native SDK events and public session APIs in integration tests, plus storage-backed Memory tests with SQLite/LibSQL and PostgreSQL. A mock that merely overwrites a map by ID does not establish provider correctness. Include remote tests against an actual local Mastra server and its existing authenticated Memory endpoints. No production calls are needed for automated acceptance; a controlled voice-call check should confirm greeting, barge-in, and shutdown behavior before release.

## Delivery plan

1. **Resolve the technical release gates.** Verify native commit/resumption ordering, cancellation, input/history deduplication, tool-result correlation, Memory feature effects, and remote API parity. Record supported SDK/storage versions and any scope decisions before fixing the public API.
2. **Implement the shared adapter and local worker opt-in.** Add message mapping, one-writer coordination, real storage validation, and flush/error behavior entirely within `@mastra/livekit`.
3. **Bind custom sessions and remote workers.** Reuse the same mapping and sequencing logic with the existing Mastra client and authenticated Memory API. Demonstrate the complete supported setup without a custom lifecycle endpoint.
4. **Document and release compatibly.** Provide API documentation, migration guidance, limitations, and a minor-release changeset. Run the focused tests and the full LiveKit package suite, build, typecheck, and lint.
5. **Validate adoption in an existing worker.** Verify the deployed worker version. Enable the adapter, remove overlapping transcript/greeting writers, and compare saved messages and next-turn context before removing any superseded transcript endpoint. Preserve application-owned call records, outcomes, and business callbacks.

## Review decisions

The proposed custom code is limited to event-to-message mapping, per-session persistence sequencing, lifecycle flushing, and coordination with existing Mastra generation and client APIs. LiveKit continues to own speech, commitment, interruption, and playback behavior. No custom transcription engine or durable delivery infrastructure is proposed.

Before implementation, confirm the supported first-release Memory configurations, the failure policy at the next-turn boundary, and the final custom-session binding API. A missing public API for tool history, native revisions, or remote configuration parity must result in an explicit scope decision, not an unannounced change to core or server packages.

## Implementation verification

Initial transcript implementation verification passed 337 tests, source and focused test type checks, package lint, ESM/CommonJS builds with declarations, and documentation checks. Storage-backed tests use real Memory with LibSQL; remote tests use the actual authenticated Mastra Hono routes through an in-process HTTP transport. A native LiveKit text session verifies committed events without provider credentials.

Initial implementation verification used `@livekit/agents` 1.7.1, `@mastra/memory` 1.37.1-alpha.2, `@mastra/libsql` 1.26.1-alpha.0, and `@mastra/client-js` 1.54.0-alpha.2. The release now requires Agents and installed LiveKit/Silero plugins `^1.9.3`, with RTC `^1.1.0` required by LiveKit. See the stable dependency audit in `TODO.md` for the subsequent verification results.

A local 1,000-message benchmark measured event-enqueue overhead at approximately 0.016 ms at the 99th percentile and the next-generation check after all writes finished at under 0.002 ms. These figures exclude network, storage, embedding, and real audio latency. Tests independently verify that blocked writes don't block the current reply and that the next generation waits for preceding writes.

PostgreSQL verification completed on October 20, 2026, using a disposable PostgreSQL 16.15 container, workspace `@mastra/pg` 1.31.2-alpha.1, and `@mastra/memory` 1.38.0-alpha.0. The test reads through an independent database connection and verifies committed interrupted text, in-place revisions, duplicate native events, stable message IDs, equal-timestamp order, and shutdown flushing. A temporary mutation that discarded revisions failed on the saved text, and the restored implementation passes. No production-code fix was needed. Semantic recall was disabled; this check does not measure embeddings or production-storage latency.

Run the PostgreSQL test with a disposable localhost database:

```sh
LIVEKIT_TEST_PG_URL=postgresql://USER:PASSWORD@127.0.0.1:PORT/DATABASE pnpm --filter @mastra/livekit test src/transcript-pg.test.ts
```

With both `LIVEKIT_TEST_PG_URL` and `LIVEKIT_TEST_ROOM_URL` configured, the full package suite passes all 386 tests with none skipped. The PostgreSQL test remains opt-in when no database URL is supplied. Before release, complete the controlled voice-call check for greeting, interruption/resumption, latency, and shutdown. Validation in an existing production deployment remains pending.

## Implementation references

- Existing message conversion and interrupted-turn handling: [messages.ts](src/messages.ts).
- Local generation and tool stream handling: [bridge.ts](src/bridge.ts).
- Remote generation and memory options: [remote.ts](src/remote.ts).
- `MastraLLM` memory and custom-session boundary: [llm-plugin.ts](src/llm-plugin.ts).
- Current playback observer and greeting writer: [speech.ts](src/speech.ts), [voice-thread.ts](src/voice-thread.ts).
- Memory save implementation and read-only configuration: [Memory](../../packages/memory/src/index.ts), [memory types](../../packages/core/src/memory/types.ts).
- Existing remote Memory client and server handlers: [client.ts](../../client-sdks/client-js/src/client.ts), [memory handlers](../../packages/server/src/server/handlers/memory.ts).
