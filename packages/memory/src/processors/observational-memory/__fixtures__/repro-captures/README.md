# OM Repro Capture Workflow

This folder stores **real runtime OM captures** used to reproduce activation/cleanup regressions.

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
  - `details.backpressure` (ratio/wait)
  - `messageDiff` (`removedMessageIds`, `addedMessageIds`, `idRemap`)
- `post-state.json` — same shape as pre-state after processing

## 3) Copy capture into this fixtures folder

Use a descriptive name:

```bash
cp -R \
  /path/to/.mastra-om-repro/<threadId> \
  packages/memory/src/processors/observational-memory/__fixtures__/repro-captures/<good-fixture-name>
```

Example naming style:

- `collapse-to-0p3k-step23-1772668741183`
- `under-removal-after-activation-<timestamp>`

## 4) Analyze a capture

From `packages/memory`:

```bash
pnpm analyze:om-repro src/processors/observational-memory/__fixtures__/repro-captures/<fixture-name>
```

The analyzer prints:

- total steps
- threshold activation count
- top token drops
- activation details (`observed`, `removed`, `added`, `idRemap`, `waitMs`, `ratio`)

## 5) Turn capture into a deterministic regression test

Add a fixture-driven test in:

- `packages/memory/src/processors/observational-memory/__tests__/observational-memory.test.ts` (runtime replay invariants)
- `packages/memory/src/processors/observational-memory/__tests__/observational-memory.repro-integrity.test.ts` (static capture assertions)

Pattern:

1. Iterate fixture step dirs.
2. Read `output.json` + `post-state.json`.
3. For threshold cleanup steps, assert invariants (example: `post.contextTokenCount >= minRemaining`).
4. Keep assertion strict so failures stay red/green and easy to diagnose.

## 6) Suggested validation command

```bash
cd packages/memory
pnpm vitest run src/processors/observational-memory/__tests__/observational-memory.test.ts -t "<test name>" -- --bail 1 --reporter=dot
```

---

If you add a new fixture, include a short note in the related test name and assertion message so future contributors can map failures back to the captured incident quickly.
