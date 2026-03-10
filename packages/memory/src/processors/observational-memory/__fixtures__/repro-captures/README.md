# OM Repro Capture Workflow

This folder documents the OM repro capture workflow and tooling.

Raw `.mastra-om-repro` captures can contain sensitive local paths, tool outputs, and conversation text. Keep raw captures local, sanitize them before sharing anything manually, and do not commit full step captures from this workflow.

## 1) Record a capture

Enable capture with one env var:

```bash
OM_REPRO_CAPTURE=1
```

Run your normal chat/agent flow until the bad behavior happens.

By default, captures are written to:

```text
<cwd>/.mastra-om-repro/<threadId>/<timestamp>-step-<n>-<uuid>/
```

Optional: set `OM_REPRO_CAPTURE_DIR` to change the base directory.

## 2) What each step captures

Each step directory contains:

- `input.json` — process input metadata (step/readOnly/state keys + JSON-safe `state` + captured replay `args`)
- `pre-state.json` — OM state before processing:
  - OM record snapshot
  - buffered chunks
  - `contextTokenCount`
  - raw `messages`
  - serialized `messageList`
- `output.json` — process output details:
  - `details.thresholdReached`
  - `details.thresholdCleanup` (`observedIds`, `minRemaining`, etc.)
  - `messageDiff` (`removedMessageIds`, `addedMessageIds`, `idRemap`)
- `post-state.json` — same shape as pre-state after processing

## 3) Sanitize a local capture before sharing it

If you need to inspect or share a local capture outside your machine, sanitize it first:

```bash
cd packages/memory
pnpm sanitize:om-repro /path/to/.mastra-om-repro/<threadId> --write
```

Use a descriptive local directory name if you copy a thread capture somewhere else for analysis, but do not commit full step captures from this workflow.

## 4) Analyze a capture

From `packages/memory`:

```bash
pnpm analyze:om-repro /path/to/.mastra-om-repro/<threadId>
```

The analyzer prints:

- total steps
- threshold activation count
- top token drops
- activation details (`observed`, `removed`, `added`, `idRemap`, `waitMs`, `ratio`)

## 5) Optional local validation

For recording/tooling changes, a focused check is usually enough:

1. Sanitize the local capture.
2. Run the analyzer against it.
3. Spot-check the sanitized JSON for removed paths/tool output before sharing it.

## 6) Suggested validation command

```bash
cd packages/memory
pnpm vitest run src/processors/observational-memory/__tests__/observational-memory.test.ts -t "<test name>" -- --bail 1 --reporter=dot
```

---

If you add a new fixture, include a short note in the fixture directory name or README update so future contributors can map it back to the captured incident quickly.
