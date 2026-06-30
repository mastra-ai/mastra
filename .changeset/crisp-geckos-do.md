---
'mastracode': minor
---

Improved push-to-talk voice input in the MastraCode TUI. Enable it with `/voice`, hold the spacebar to dictate, and release to finish — your speech streams into the input box in real time.

**Choose how you dictate**

`/voice` is now an interactive settings menu. You can toggle voice on/off, pick a transcription engine, and (for cloud transcription) pick a provider and model. Run `/voice status` to see the current engine, provider/model, and whether it's ready to use. The quick toggles `/voice on` and `/voice off` still work.

**On-device transcription on macOS**

On macOS, voice now defaults to a native on-device engine (Apple's `SFSpeechRecognizer`). It's free, works offline, and streams words into the input box with low latency — no API key required.

When you turn voice on, the TUI checks the macOS Microphone and Speech Recognition permissions for you and guides you through whatever is needed: if access is blocked it offers to open the exact Privacy & Security pane (and tells you to enable "MastraCode Voice" there); if macOS simply hasn't asked yet, it explains that the first time you hold space it will prompt and you should click Allow. The same guidance appears in `/voice status` and, if dictation ever fails on a permission problem, alongside the error — so you're never left guessing what to do.

**Multiple cloud providers, not just OpenAI**

Cloud transcription is no longer locked to OpenAI Whisper. You can pick from several providers — OpenAI, Groq and other OpenAI-compatible Whisper hosts, plus Deepgram via its own SDK — and choose a model for each. Set the matching API key via the provider's environment variable or `/api-keys`; if a key is missing, `/voice` points you to `/api-keys`.

You still need a local audio recorder on your `PATH` for the cloud engine — `rec`/`sox` (recommended) or `ffmpeg` on macOS, and `pw-record`/`parecord`/`arecord`/`sox` on Linux. Non-macOS systems default to the cloud engine.

**Reliability fixes**

macOS native engine:

- It now triggers the permission prompt and works end-to-end. The on-device recognizer ships as a proper `.app` bundle — `Contents/MacOS/<binary>` plus a generated `Contents/Info.plist` with the Speech Recognition and Microphone usage descriptions — that is ad-hoc signed (`codesign -f -s -`) so the plist binds into the signature.
- The bundle is launched through macOS LaunchServices (`open`), the only launch path that makes macOS show the permission dialogs. A bare command-line executable — even one with an embedded, signed Info.plist — never fires `SFSpeechRecognizer.requestAuthorization`, so the Allow prompt never appeared and the recognizer was silently denied.
- Because a LaunchServices-launched app has no stdin/stdout pipe back to the CLI, the recognizer talks to the TUI over files: it appends newline-delimited JSON events to an events file the engine tails, and the engine asks it to flush a final result and quit by writing a stop sentinel file the recognizer polls for. The engine buffers partial lines so an event split across reads is never dropped, and it lets the recognizer see the stop sentinel before tearing the process down.
- `/voice status` does a real readiness check: it verifies the Swift toolchain and probes the actual Speech Recognition and Microphone permission state, naming exactly which one to enable in System Settings (and explaining the first-run prompt when permission hasn't been requested yet). The probe runs through the same `.app` bundle so it reads authorization under the bundle's TCC identity — probing the loose binary would query a different identity and wrongly report "not granted".
- If the recognizer exits before it can start (suppressed prompt or TCC kill), the engine surfaces a clear, actionable error with its captured output. A not-yet-determined permission state is no longer dressed up as the cause of a real crash, so you no longer see a misleading "macOS will prompt next time" message in red. The recognizer's Swift source and plist ship with the built CLI so the bundle can be built on first use.

Cloud engine:

- The live-partial loop is more robust: non-overlapping ticks and de-duplicated partials, and the terminal callback always fires on stop (final transcript, empty result, or error).
- First-dictation latency is reduced: the provider client is built once per dictation and reused across ticks so its HTTP connection stays warm (keep-alive), removing the DNS + TLS handshake cost that made the first dictation lag. The loop also polls at a short cadence until the recorder produces usable audio, so the opening partial fires as soon as there's something to transcribe.
