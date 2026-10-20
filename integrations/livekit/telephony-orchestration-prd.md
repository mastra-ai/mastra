# Telephony orchestration through LiveKit

**Status:** Implemented and locally verified. Controlled carrier/audio checks remain pending.

**Package:** `@mastra/livekit`

**Branch:** `codex/livekit-stable-dependencies`

## Outcome

An application can dispatch an outbound phone job or receive an inbound SIP job with the existing Mastra worker. LiveKit owns dialing, SIP status, timeouts, audio transport, and room lifecycle. Mastra supplies agent selection, request context, memory, and conversation behavior.

This is the next step after shared session configuration and committed transcript persistence. It does not introduce a separate call database or replace application-specific business lifecycle and outcome handling.

## Verified native capabilities

Checked against the installed Agents 1.9.3 and Server SDK 2.19.1, and LiveKit's current telephony documentation.

| Concern                           | Existing LiveKit API                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| Dispatch a worker                 | `AgentDispatchClient.createDispatch`, already exposed by `dispatchVoiceSession`    |
| Dial a phone                      | `SipClient.createSipParticipant`                                                   |
| Wait for an answer                | `CreateSipParticipantOptions.waitUntilAnswered`                                    |
| Ringing and maximum call duration | Native `ringingTimeout` and `maxCallDuration`, in seconds                          |
| Dial-request timeout              | Native `timeout`; the SDK sizes the answer-wait request against its ringing window |
| Carrier failure information       | Native `SipCallError`, including `sipStatusCode` and `sipStatus`                   |
| Inbound room and agent routing    | Native SIP dispatch rules with `roomConfig.agents`                                 |
| Obtain the caller                 | `JobContext.waitForParticipant(identity?)`, returning a native remote participant  |
| Bind the session to that caller   | Native `RoomInputOptions.participantIdentity`                                      |
| Audio subscription                | Native `AgentSession` / room output; no additional media-readiness timer           |
| Stop a failed dedicated call      | Native room deletion and job shutdown APIs                                         |

The installed Node SDK does not supply one operation that combines dispatch, dialing, startup, and failure cleanup. `waitForParticipant` confirms room membership; it does not wait for SIP answer status. A separate server-side dial with `waitUntilAnswered: false` therefore cannot be treated as an answered call by the worker.

## Proposed outbound flow

1. The application authorizes the destination and uses the existing `dispatchVoiceSession` helper with a unique room name and job metadata. Recording can be configured through the existing helper before dispatch.
2. The worker resolves its Mastra agent and trusted dialing configuration. Invalid agent or configuration errors occur before any outbound SIP request.
3. After connecting to the job room, the worker calls `SipClient.createSipParticipant` with `waitUntilAnswered: true`.
4. LiveKit handles ringing and the answer wait. Pass its existing participant options through without inventing another timeout or retry mechanism.
5. Use the returned native participant identity to link the voice session to that caller. Start the native session and then the configured greeting.
6. Preserve native SIP errors. For explicitly configured dedicated call rooms, use native cleanup on failed setup and retain the original failure for the application to inspect.

Dispatch success means the dispatch request was accepted. It does not mean a worker is ready, a telephone has answered, or a human is listening. Answer confirmation can include voicemail or an automated phone menu. Audio subscription is a separate native step and does not prove that a person heard the greeting.

Cleanup is a best-effort native API operation, not a rollback guarantee. A network timeout can leave the remote result uncertain. Do not automatically redial, label an uncertain outcome as a carrier rejection, or delete a shared room. Cleanup failures must remain observable; the installed `JobContext.deleteRoom()` logs and swallows deletion errors, so a design requiring explicit cleanup results should use the native `RoomServiceClient` directly.

The application supplies a configured native `SipClient`. Credentials and trunk selection remain host configuration, with no new project registry or secrets in dispatch metadata. Existing native client instances and types should be reused.

## Proposed inbound flow

1. The host configures an existing LiveKit SIP dispatch rule to create a separate room per call and dispatch the named Mastra worker. Use native rule metadata for the initial agent/routing hint.
2. An opt-in worker path connects and obtains the native caller participant before resolving the Mastra agent and request context.
3. A host-supplied resolver receives the original metadata, `JobContext`, and native participant. It returns the existing shared session metadata: agent, memory identifiers, request context, and optional session settings.
4. The worker validates the resolved session settings when shared-session validation is enabled, selects the agent, and starts the session bound to that caller.
5. Unknown or rejected routes fail before greeting or generation. Cleanup for dedicated inbound rooms is explicit.

The resolver owns authorization and business routing. SIP phone-number attributes are caller information, not authenticated customer identity. The package does not silently map caller ID to an existing customer's memory.

A single worker can select inbound, outbound, or ordinary browser behavior per job. Browser behavior remains unchanged unless the new options are enabled.

## Approved adapter boundary

The custom code is limited to sequencing existing LiveKit operations around Mastra worker setup, passing native participant data to a host resolver, and selecting native cleanup on setup failure. It is still new Mastra-owned orchestration code, even though every telephony operation uses LiveKit.

The user's earlier instruction was: "We should use the LiveKit APIs exclusively - we should avoid writing any custom functionality, please check in with me if something is required outside of that."

The user approved the thin adapter on October 20, 2026. The approval covers this sequencing glue while keeping telephony state, timeouts, and retries with LiveKit.

## API direction

Extend `createLiveKitWorker` with opt-in telephony configuration and a pre-session metadata resolver. Reuse `CreateSipParticipantOptions`, native client/participant types, and the existing `LiveKitSessionMetadata`. Use a trusted per-job callback to support both inbound and outbound jobs. The implemented options are `telephony` (static or a per-job resolver), outbound `sipClient` / `participantOptions`, inbound `resolveMetadata`, and optional `deleteRoomOnFailure` using a native `RoomServiceClient`.

Retain `dispatchVoiceSession` and its native return value. Do not create a new server route or promise a synchronous answered result from dispatch. Expose the resulting native participant information to worker callbacks without defining a parallel Mastra call-status enum.

## Excluded from this change

- Custom SIP-active polling, media-readiness heuristics, timers, retry loops, or state machines.
- Atomic or durable dispatch/dial transactions, application-level redial deduplication, or guaranteed completion delivery.
- Custom call records, call-history endpoints, billing, business outcomes, or completion callbacks.
- Dynamic LiveKit project registries, provider provisioning, or tenant credential policy.
- DTMF tools, answering-machine policy, silence reprompts, and new greeting modes.
- Changes to `@mastra/core`, `@mastra/server`, examples, or downstream application repositories.

If an acceptance requirement cannot be met through native functionality and the approved sequencing adapter, return for a separate scope decision rather than adding a workaround.

## Verification plan

Use the real LiveKit server SDK against a local HTTP test service at the external-service boundary. Test outbound success, busy/rejection, ringing failure, transport ambiguity, and cleanup failure while preserving native error details. Verify no dial occurs for invalid configuration and no greeting occurs before the native answer wait completes.

Exercise inbound routing through the worker's public API with native participant data, including unknown routes, caller identity selection, request-context propagation, and isolated memory identifiers. Preserve browser behavior and existing transcript persistence. Avoid SDK method mocks that only echo arguments.

Run focused telephony tests, then the LiveKit package suite, source type checking, package build/lint, and canonical documentation checks. Add a package changeset for the new opt-in behavior.

Keep a controlled real SIP call check pending until a test trunk and destination are explicitly selected. Automated tests must never place a real phone call. PostgreSQL verification is recorded below. The previously requested live voice-call check remains pending.

## Implementation verification

- Initial telephony verification passed all 361 enabled LiveKit package tests. Subsequent DTMF and PostgreSQL verification brings the full suite to 386 passing tests with none skipped.
- The 24 new telephony tests exercise native server SDK requests over local HTTP and inbound worker startup against a real local LiveKit server (1.13.10), with native RTC participants and real LibSQL-backed Memory. The SIP service boundary is simulated; no telephone network was contacted.
- Removing native answer waiting makes the test observe an early greeting. Removing explicit caller binding makes the native room test receive the unrelated participant's text. Both mutations were restored after confirming failure.
- Caller isolation passed 20 consecutive native-room runs.
- All 24 telephony tests and source type checking also pass with supported Zod 3.25.76; the normal dependency remains Zod 4.6.7.
- Package lint, source and focused test type checks, ESM/CommonJS builds with declarations, and documentation checks pass. Four application documentation examples type-check against the built public entrypoints.

Run the optional native-room suite with a local test server:

```bash
livekit-server --dev --bind 127.0.0.1 --port 17880
LIVEKIT_TEST_ROOM_URL=ws://127.0.0.1:17880 pnpm --filter @mastra/livekit test src/telephony-room.test.ts
```

The suite defaults to the development key/secret and accepts `LIVEKIT_TEST_ROOM_API_KEY` and `LIVEKIT_TEST_ROOM_API_SECRET` for a differently configured local server. It rejects non-local server URLs and never provisions or dials a real SIP trunk. Without the URL, these five native-room tests are skipped; the 19 HTTP SDK tests still run.

PostgreSQL verification passed on October 20, 2026; see `transcript-persistence-prd.md` for coverage and tested versions. A real carrier/audio call remains a release check. Validation in an existing production deployment remains pending.

## Sources

- [LiveKit outbound calls](https://docs.livekit.io/telephony/making-calls/outbound-calls/)
- [LiveKit inbound dispatch rules](https://docs.livekit.io/telephony/accepting-calls/dispatch-rule/)
- [LiveKit job lifecycle](https://docs.livekit.io/agents/server/job/)
- Installed `livekit-server-sdk/src/SipClient.ts` and `@livekit/agents/src/job.ts` / `src/voice/room_io`.
