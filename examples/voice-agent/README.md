# Voice agent example — BrightSmile Dental call center

A customer service voice agent built with [`@mastra/livekit`](../../integrations/livekit). LiveKit runs the audio loop (WebRTC, speech-to-text, semantic turn detection, barge-in, text-to-speech); the Mastra agent answers every turn with its own model, tools, and memory.

The demo agent "Riley" works the front desk of a fictional dental clinic and can:

- Look up customers by phone number or name (`lookupCustomer`)
- Check open appointment slots (`checkAvailability`)
- Book, reschedule, and cancel appointments (`bookAppointment`, `rescheduleAppointment`, `cancelAppointment`)

The "CRM" is in-memory and seeded with three customers. Try: **Maya Rodriguez, 555-0142** (has an appointment already), James Chen (555-0177), Priya Patel (555-0163).

## Setup

1. Create a free LiveKit Cloud project at [cloud.livekit.io](https://cloud.livekit.io), then copy the URL, API key, and secret from **Settings → API Keys**. The free tier includes inference credit, so the Deepgram/Cartesia model strings work without separate accounts.

2. Copy `.env.example` to `.env` and fill in the LiveKit credentials and your `OPENAI_API_KEY`.

3. Install dependencies (this example links the workspace packages, so build the monorepo packages first if you haven't):

   ```bash
   pnpm install
   pnpm worker:download-files   # one-time: downloads the turn-detection and VAD models
   ```

   Use plain `pnpm install` — this example is its own pnpm workspace root. Do not pass `--ignore-workspace`: that drops the local `pnpm-workspace.yaml` overrides and installs published Mastra packages from the registry instead of the linked monorepo packages. If that happens, delete `node_modules` and `pnpm-lock.yaml`, then run `pnpm install` again and check the install output shows `<- ../../packages/core` style links.

## Run

Three processes:

```bash
# 1. Mastra server (API on :4111)
pnpm dev

# 2. Voice worker (registers with LiveKit Cloud, answers calls)
pnpm worker

# 3. Studio with voice mode (from the monorepo, served on :5173)
pnpm --dir ../.. dev:playground
```

Or combine 1 and 3 with `pnpm dev:ui` and run `pnpm worker` in a second terminal.

## Test the call

Open Studio, point it at `http://localhost:4111`, and open the **BrightSmile Call Center** agent chat. Click the phone button in the composer and allow microphone access. You should hear Riley's greeting.

Things to try:

- "Hi, I'd like to book a cleaning. My phone number is five five five, zero one four two." — account lookup plus scheduling, with filler speech while tools run.
- Pause mid-sentence ("I was wondering if… hmm…") — the semantic turn detector should wait for you to finish.
- Interrupt Riley while it's speaking — playback stops and it listens (barge-in).
- Hang up, then look at the chat thread: the voice conversation is persisted to the same memory thread. Call again and reference the earlier call.

## Traces

The example ships with Mastra Observability enabled. Every voice turn the worker handles — agent run, model call, tool executions — is exported to the shared LibSQL database, so after a call you can open **Observability** in Studio to inspect the traces.

Everything (memory, threads, traces) lives in one `voice-agent.db` file at the project root. SQLite handles the server and the voice worker writing concurrently; single-writer stores such as DuckDB don't work here because the worker is a separate process.

## Troubleshooting

- **"LiveKit is not configured" toast in Studio**: the Mastra server can't see your `.env` — restart `pnpm dev` after editing it.
- **Worker connects but never joins a call**: the `agentName` in `voice-worker.ts` and `liveKitConnectionRoute()` must match (both `mastra-voice` here).
- **Connected but silent**: check the worker terminal — STT/TTS model errors (for example, exhausted inference credit) appear there.
- **"Required model files not found locally" on worker start**: the turn-detection model cache is tied to the installed dependency tree, so reinstalling dependencies can orphan it. Run `pnpm worker:download-files` again.
- **"Thread not found" in the server terminal**: the database file was recreated while the server or worker was still running — a running process keeps writing to the deleted file while a restarted one opens a fresh empty file, so they silently diverge. This happens when `pnpm clean` (which deletes `*.db`) runs while either process is up. Stop the server and the worker, then clean, then start both together. Conversations from before the clean are gone; start a new chat.
- **"This storage provider does not support batch creating logs"**: a one-time notice that LibSQL doesn't persist observability logs locally. Traces still work; the exporter drops log events after the first attempt.
