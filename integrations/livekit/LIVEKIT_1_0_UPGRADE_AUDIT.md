# LiveKit dependency audit for Mastra 1.0

Investigated September 21, 2026 against the current working tree, including the pending recording and Studio playback additions. This is a release recommendation, not an applied dependency upgrade.

**Implementation follow-up:** the VAD fix and migration guide are now committed. The isolated Agents 1.9 prerelease passes 238 tests on Node 22.13 and Node 25, and has been exercised through real browser audio. Repository manifests and lockfiles remain unchanged; real phone and S3 validation remain open. See [the validation record](./LIVEKIT_1_0_VALIDATION.md) for results and limits. The original investigation below is retained as the rationale for the version selection.

**Recommendation:** target Agents 1.9.0 and Server SDK 2.19.1, keep RTC on the supported 0.13.x line, and make the supported dependency range explicit for Mastra LiveKit 1.0. The current source compiles, builds, and passes all 232 existing integration tests with this combination. A separate diagnostic reproduced an existing `vad: false` bug that should be fixed before release. Live voice and production S3 validation remain release gates.

## Version set

| Dependency                       | Current declared range                       | Current workspace lock   | Candidate tested |
| -------------------------------- | -------------------------------------------- | ------------------------ | ---------------- |
| `@livekit/agents`                | Peer `^1.4.0`; development `^1.7.1`          | 1.7.1                    | **1.9.0**        |
| `@livekit/agents-plugin-livekit` | Optional peer `^1.4.0`; development `^1.7.1` | 1.7.1                    | **1.9.0**        |
| `@livekit/agents-plugin-silero`  | Optional peer `^1.4.0`; development `^1.7.1` | 1.7.1                    | **1.9.0**        |
| `livekit-server-sdk`             | `^2.15.4`                                    | 2.16.0                   | **2.19.1**       |
| `@livekit/protocol`              | `^1.46.6`                                    | Direct dependency 1.46.6 | **1.52.0**       |
| `@livekit/rtc-node`              | Transitive peer of Agents and Silero         | 0.13.34                  | **0.13.35**      |

These are published stable versions, verified from the npm registry rather than search snippets: [Agents metadata](https://registry.npmjs.org/@livekit%2fagents/1.9.0), [LiveKit plugin metadata](https://registry.npmjs.org/@livekit%2fagents-plugin-livekit/1.9.0), [Silero metadata](https://registry.npmjs.org/@livekit%2fagents-plugin-silero/1.9.0), [Server SDK metadata](https://registry.npmjs.org/livekit-server-sdk/2.19.1), [protocol metadata](https://registry.npmjs.org/@livekit%2fprotocol/1.52.0), [RTC metadata](https://registry.npmjs.org/@livekit%2frtc-node/0.13.35).

All candidate versions except an RTC 1.x upgrade already fit our broad dependency ranges. Consequently, consumers with fresh lockfiles can already receive newer LiveKit behavior while this checkout tests 1.7.1. Updating the development dependencies alone does not establish a clear support policy.

The latest RTC is **1.1.0**, but Agents 1.9.0 and Silero 1.9.0 require **`^0.13.34`**, which excludes 1.x. RTC 1.0 was a stability designation, not an announced API rewrite; it still cannot be treated as supported by Agents until its peer range changes. Do not force an override or ignore peer warnings for 1.0. Both optional plugins also require the exact matching Agents version, so update the three packages together. [RTC release notes](https://github.com/livekit/node-sdks/blob/main/packages/livekit-rtc/CHANGELOG.md)

`livekit-client` belongs to Studio, not this integration's dependency graph. Its lockfile version is 2.20.0 and published latest is 2.22.3. A browser SDK update should receive its own frontend review; it is not required by the candidate server/worker set. [Client metadata](https://registry.npmjs.org/livekit-client/2.22.3)

## Changes affecting the 1.7.1 baseline

| Change                                                              | Impact on Mastra and migration action                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ElevenLabs removed from LiveKit Inference in Agents 1.8.0           | Customers using gateway model strings need another supported inference provider or the standalone ElevenLabs plugin with its own credentials. The standalone plugin remains supported. Mastra's plugin-instance escape hatch accommodates that migration. [Upstream removal](https://github.com/livekit/agents-js/pull/2415)                                                                                                                                     |
| Expanded OpenTelemetry GenAI attributes in 1.8.0                    | Review exporter configuration and dashboards, including whether conversational content may leave the application. Content was already exported; the change standardizes and expands its representation. `allowPii: false` or `LIVEKIT_TELEMETRY_ALLOW_PII=0` limits third-party export, while project redaction remains authoritative. This is separate from our `voice call` metrics bridge. [Telemetry change](https://github.com/livekit/agents-js/pull/2411) |
| Shutdown/report lifecycle changes in 1.8.0                          | `onSessionEnd` is added before internal report cleanup; log flushing, report retries, and shutdown ordering change. Our `onCallEnd` uses `ctx.addShutdownCallback`, which still exists. Verify hook completion, trace finalization, and worker termination under disconnects and deployment shutdown. Do not silently replace the hook with the new callback without defining its ordering. [Lifecycle change](https://github.com/livekit/agents-js/pull/2387)   |
| Existing custom audio/transcription outputs are preserved by RoomIO | Customers using `onSessionStart` or their own sessions may observe different routing if they previously relied on RoomIO replacing those outputs. Our ordinary room path has no such custom output. [RoomIO change](https://github.com/livekit/agents-js/pull/2296)                                                                                                                                                                                              |
| Server SDK 2.19.1 requires `exp` during token verification          | Hand-signed tokens without expiry now fail. A diagnostic confirmed acceptance under 2.16.0 and rejection under 2.19.1. Our route creates expiring tokens with a default 15-minute TTL and still passes verification. Webhook verification also uses this verifier. [Verifier change](https://github.com/livekit/node-sdks/pull/710)                                                                                                                              |
| Server SDK 2.17+ enables Cloud region failover by default           | Retryable failures can produce additional requests and longer total latency. Version 2.19 adds a request ID preserved across failover attempts. If region restrictions or request deadlines matter, expose and document server client options deliberately. The current wrappers do not expose `ClientOptions.failover`. [Failover](https://github.com/livekit/node-sdks/pull/686), [idempotency](https://github.com/livekit/node-sdks/pull/711)                 |
| Server SDK removes Node crypto fallbacks                            | Requires global Web Crypto. Our Node `>=22.13.0` contract already provides it. No Node minimum increase is required by the reviewed packages; restricted runtimes must still provide Web Crypto. [Crypto change](https://github.com/livekit/node-sdks/pull/704)                                                                                                                                                                                                  |

The remaining changes include fixes for interruptions, session handoffs, trailing STT transcripts, audio retention, and timing. These are reasons to upgrade, but passing type checks cannot establish their behavior on a real call. [Agents release notes](https://github.com/livekit/agents-js/blob/main/agents/CHANGELOG.md)

Direct Server SDK consumers should also review SIP/connector options: the published type diff removes `AcceptWhatsAppCallOptions.ringingTimeout`, introduces timeout controls, and changes documented SIP timeout defaults. `TwirpError` remains an alias, and existing individual service clients remain available. Our integration does not call those SIP/WhatsApp methods; dispatching a phone session does not itself dial the phone. [Server SDK source](https://github.com/livekit/node-sdks/tree/main/packages/livekit-server-sdk/src)

## Customers upgrading from the supported 1.4.x line

The compatibility story is broader than the changes since our development baseline:

- **Tools:** LiveKit 1.5 changes `ToolContext` from a map to a class, adds named tool lists and duplicate-name checks, returns defensive copies, and replaces `ProviderDefinedTool` with an abstract `ProviderTool`. Our Mastra tools execute through Mastra, so ordinary users do not need to rewrite them. Users owning LiveKit agents/tools or custom plugins do need to review that API. [Tool implementation](https://github.com/livekit/agents-js/blob/main/agents/src/llm/tool_context.ts)
- **Important qualification:** the 1.5 changelog's initial breaking-change description is broader than the final shipped API. Version 1.9.0 still accepts object shorthand with anonymous tools. It would be incorrect to tell every user to convert every tool map into a list. The class-based context and provider-tool changes remain material. This was checked against the published 1.9.0 declarations and source.
- **VAD and turn detection:** since 1.4.7, omitting VAD provisions a bundled detector; disabling it requires `null`. Upstream also introduced `inference.VAD` and `inference.TurnDetector`, and deprecated the legacy Silero and text-turn-detector paths. Changing to the newer detector can change model downloads, endpointing, native dependencies, and cloud/local behavior. [Upstream migration](https://github.com/livekit/agents-js/pull/1719)
- **Operational behavior:** older installations cross changes to adaptive interruption transport, drain defaults, audio buffering, and telemetry attribute names. Include these in the migration guide rather than assuming all users started on 1.7.1. [Agents release history](https://github.com/livekit/agents-js/blob/main/agents/CHANGELOG.md)

## Confirmed Mastra issue to fix before 1.0

In `src/worker.ts`, `vad: false` skips the legacy plugin but leaves the value passed to `AgentSession` as `undefined`. The real LiveKit constructor interprets that as automatic VAD. A temporary diagnostic exercised our worker entry with the real 1.9.0 session constructor and reproduced enabled VAD despite `vad: false`.

This is **already present on 1.7.1**, not a regression introduced by 1.9.0. A separate check confirmed `undefined` enables VAD and `null` disables it on both versions. The existing worker test only checks that prewarm does not populate a VAD, so it misses session construction.

Fix the mapping to pass `null` when `vad: false`, preserve explicitly supplied VAD instances and documented `sessionOptions` precedence, and add a session-construction regression test. Current callers can explicitly set `sessionOptions: { vad: null }` as a workaround.

For the broader detector migration, make a separate 1.0 design decision: either preserve legacy defaults for the initial release with a documented transition, or adopt native inference defaults and describe the behavioral change. Do not silently reinterpret `'english'` and `'multilingual'` as a different detector. Upstream still ships both plugins at 1.9.0, so removing them is not required for this dependency upgrade.

## Recording and S3 implications

No source/type break was found in the recording path. The published `RoomEgress`, `RoomCompositeEgressRequest`, and `S3Upload` declarations are unchanged between our direct protocol baseline and 1.52.0. The candidate passed our dispatch, token-route, recording-route, and export tests.

The Server SDK's new unified `startEgress()` API is additive. Our room-creation auto-egress setup can remain as implemented; there is no required migration to the new RPC. LiveKit still uploads to the configured S3 destination, and playback still resolves a private object through the application. No change to the S3 IAM policy follows from this dependency update. [Server SDK releases](https://github.com/livekit/node-sdks/blob/main/packages/livekit-server-sdk/CHANGELOG.md)

Keep our room-level `recording` option distinct from LiveKit Agents' own `AgentSession.start({ record })` telemetry/session recording. Disabling one must not be described as disabling the other. Cloud project recording settings are not a replacement for the application's S3 recording policy.

Protocol 1.52.0 passed with Server SDK 2.19.1, which internally pins protocol 1.51.0. An optional simplification is to import `RoomConfiguration` and `RoomAgentDispatch` from `livekit-server-sdk`, which already re-exports them, and remove our separate direct protocol dependency. That would require its own verification and was not applied here.

## Proposed release sequence

1. Adopt the exact tested development versions, keep RTC within `^0.13.34`, and update installed provider plugins in lockstep with Agents. Raise the documented minimum Agents version to 1.9.0. For the first 1.0 release, consider supporting the 1.9.x family explicitly and expanding the peer range after CI validation of later minors, since previous minors contained breaking changes.
2. Align the Zod peer contract with Agents' `^3.25.76 || ^4.1.8`; our current `>=3.0.0 || >=4.0.0` promises much more than that. This investigation exercised the installed Zod 4.4.3, not every supported Zod version. Keep the existing Node minimum, then verify it in CI.
3. Fix the confirmed VAD opt-out bug. Decide and document whether 1.0 also changes the default detector implementation. Treat these as explicit behavior changes in the migration guide.
4. Add migration notes covering old LiveKit tools, retired inference models, expiring tokens, telemetry content policy, and shutdown behavior. Preserve the public `recording` name and the separation of server-safe, worker, and plugin entry points.
5. Validate a real browser call and a real phone call: both speakers, interruption, tool execution, greeting/consent policy, normal and abnormal hangup, `onCallEnd`, final trace, S3 recording, and Studio Review Audio. Include recording disabled and an existing-room rejection case.
6. Test a clean install on the supported Node minimum and the actual Linux deployment image, including native libraries, VAD/turn model downloads, startup, and shutdown. Publish an opt-in 1.0 prerelease before promoting to stable; keep the prior lockfile/deployment available for rollback.

## Evidence and limits

All experiments used `/tmp/mastra-livekit-upgrade-audit/candidate`, a copy of the integration source linked to the existing Mastra core and test tools. No repository dependency manifest or lockfile was changed. Public registry metadata and downloaded package archives were saved alongside it.

| Check                                                         | Result                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| TypeScript on the candidate dependency set                    | Passed                                                                                                                       |
| Existing integration suite                                    | 18 files, 232 tests passed                                                                                                   |
| Additional diagnostics                                        | 4 passed: no-exp rejection, normal token acceptance, VAD defaults on both baselines, current worker opt-out bug reproduction |
| Package build                                                 | ESM, CJS, and declaration generation passed                                                                                  |
| Built root entry-point imports                                | ESM and CJS loaded successfully                                                                                              |
| Actual LiveKit calls / S3 uploads with candidate dependencies | Not run in this investigation                                                                                                |
| Node/platform                                                 | Node 25.8.1, macOS arm64; not the minimum Node or production Linux image                                                     |

The temporary dependency installation disabled lifecycle scripts. Native imports used available package binaries; this does not verify a fresh production image or model downloads. The suite emitted a macOS duplicate-libvips warning. The cross-version diagnostic additionally loaded two RTC native copies in one process and emitted duplicate-class warnings; that mixed-version probe is not a deployment pattern to use.

Logs and diagnostic source are retained in `/tmp/mastra-livekit-upgrade-audit`: `tests.log`, `typecheck.log`, `build.log`, `probes.log`, and `candidate/src/upgrade-audit.test.ts`. The diagnostic assertions deliberately confirm the current bug; they are evidence, not a shipped regression fix.
