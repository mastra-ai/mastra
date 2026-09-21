# LiveKit 1.0 prerelease validation

Validated September 21, 2026. The VAD fix and migration guide are implemented. Agents 1.9 is the tested baseline in an isolated prerelease installation. **This is not release sign-off:** phone and production S3 validation remain outstanding.

Repository dependency manifests and lockfiles were not changed for this upgrade. Consequently, the repository's existing peer ranges still allow older LiveKit releases; the 1.9 minimum is documented and tested, but is not enforced by the published manifest. The temporary package manifest used for this validation is not a replacement for a release-time dependency update.

## Package under test

The locally packed `mastra-livekit-1.0.0-next.0.tgz` contains the current integration build, including the VAD fix and the pending recording additions. It was installed into an isolated copy of `examples/voice-agent`; it was not published to npm.

| Component                             | Version             |
| ------------------------------------- | ------------------- |
| `@mastra/livekit` local archive       | `1.0.0-next.0`      |
| Agents, LiveKit plugin, Silero plugin | `1.9.0` each        |
| RTC Node                              | `0.13.35`           |
| Server SDK                            | `2.19.1`            |
| Direct protocol dependency            | `1.52.0`            |
| Zod                                   | `4.4.3`             |
| Tested Node runtimes                  | `22.13.0`, `25.8.1` |
| Platform                              | macOS arm64         |

Archive SHA-256: `dd9286b573e4fe3b39cb149064dbcb23b1e2cca622501815b9ee874494539f3f`.

The temporary archive declares Agents/plugins `>=1.9.0 <1.10.0` and Zod `^3.25.76 || ^4.1.8`. Mastra workspace packages were linked from their local builds. This validates the LiveKit version combination, not a clean installation of every Mastra package from npm.

## Automated checks

| Check                                                         | Result                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| VAD regression before the fix                                 | Failed as expected: `vad: false` enabled LiveKit's bundled VAD |
| Worker tests after the fix on the existing 1.7.1 installation | 62 passed                                                      |
| Full integration suite with Agents 1.9 on Node 25.8.1         | 238 passed across 18 files                                     |
| Full integration suite with Agents 1.9 on Node 22.13.0        | 238 passed across 18 files                                     |
| Integration TypeScript and focused lint                       | Passed                                                         |
| Candidate ESM, CJS, and declaration build                     | Passed                                                         |
| Isolated example TypeScript check                             | Passed after aligning Zod with the linked Mastra build         |
| Migration guide formatting, Remark, and Vale                  | Passed                                                         |

The six new session-construction tests retain the real LiveKit `AgentSession` constructor. They cover opt-out, explicit VAD instances, prewarmed defaults, and both directions of the `sessionOptions.vad` override. A mocked constructor would miss the original bug.

The initial isolated example install resolved another Zod version alongside the linked workspace packages and did not typecheck. Sharing their existing Zod 4.4.3 installation and adding the example's missing Node types resolved that check, without repository manifest edits. macOS native imports also emitted a duplicate-libvips warning; the production Linux image still needs validation.

## Browser calls

Studio ran against the isolated example server and a separately named worker, `mastra-livekit-1-0-prerelease`. Chromium used synthetic speech as its microphone input. Signaling, audio, speech recognition, speech synthesis, and model requests used the configured LiveKit Cloud project and real providers.

- A 65-second call played the greeting, transcribed the caller, spoke a relevant reply, stayed connected, and returned Studio to idle after explicit hangup. WebRTC reported 158,968 received audio bytes, positive received audio energy, 64,312 sent bytes, and zero lost inbound packets.
- A second call interrupted the spoken response, accepted the new utterance, and continued with a reply. It also stayed connected until explicit hangup.
- A Node 22.13 call requested a customer lookup against the example's fixture data. The agent executed `lookupCustomer`, spoke the configured tool feedback, and read the result aloud.
- Earlier calls ended automatically because the example's model invoked `endCall`. The saved trace contains the successful tool call; this was not evidence of a transport disconnect. The example's decision to end a call prematurely remains a separate conversation-quality concern.
- The completed long call's `voice call` root span has `status: success`, an end timestamp, and final usage totals. Its trace contains 32 spans.

The post-call hook ran and saved summaries. The example also logged an OpenAI structured-output schema rejection for `propertyNames` during post-call memory extraction. Hook execution is verified; successful structured extraction must not be inferred from it.

These runs had `LIVEKIT_RECORDING_ENABLED=false`. They do not validate an S3 upload or Studio recording playback on the candidate versions. No recording credentials were available in the test environment.

## Remaining release gates

1. **Real phone call:** the configured project has zero inbound trunks, zero outbound trunks, and zero SIP dispatch rules. Supply a working SIP setup and an authorized test destination before attempting a call. A successful agent dispatch alone is not phone validation.
2. **Recording and playback:** repeat the browser and phone calls with a reachable S3 destination, then verify completed egress, both speakers in the file, the finalized trace, and Studio's Review Audio player. Use the scoped permissions in [the recording test guide](../../examples/voice-agent/RECORDING_TEST.md); administrator access is unnecessary.
3. **Deployment:** validate a clean installation in the actual Linux image, including native dependencies, model downloads, startup, and graceful deployment shutdown. The macOS Node 22 run does not establish Linux compatibility.
4. **Release metadata:** before publishing a package that promises a 1.9 minimum, update its dependency/peer ranges and release metadata deliberately. Those repository files remain unchanged under the current task constraint.

For the phone test, dispatch into a fresh room first and await `dispatchVoiceSession()` before adding the SIP participant to that exact room. Use the prerelease worker's agent name and avoid a second automatic agent dispatch. Check speech in both directions, interruption, a tool result, caller hangup, agent hangup, `onCallEnd`, and final trace status. With recording enabled, wait for egress completion before checking S3; dispatch does not dial the destination or prove that a recording exists. The [recording test guide](../../examples/voice-agent/RECORDING_TEST.md) describes this sequencing and the production S3 setup.

## Local evidence

Temporary evidence is under `/tmp/mastra-livekit-1.0-prerelease`: the package archive, `tests.log`, `node22-tests.log`, `build.log`, `example-typecheck-aligned.log`, `browser-long-result.json`, `browser-interruption-result.json`, `browser-lookup-result.json`, `browser-trace.json`, and `sip-readiness.json`. Screenshots are saved in this task's visualization directory. Temporary files are not release artifacts and may be removed by the operating system.

Worker logs can contain provider response headers. Review sanitized test results rather than attaching raw logs, environment files, participant tokens, or signed playback URLs to a release report.
