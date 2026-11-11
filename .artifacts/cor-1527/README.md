# COR-1527 evidence artifacts

Evidence-only tooling for COR-1527. No package source was modified. See `REPORT.md` for findings.

## Layout

- `scripts/harness.mjs` — one run: one agent streaming 16-char chunks every 50 ms through `Mastra` on a `RedisStreamsPubSub`, with an optional `docker pause` outage on the disposable Redis. Imports the built `dist` of `@mastra/core`, `@mastra/redis-streams`, `@mastra/redis`.
- `scripts/run-pair.sh <plain|durable> <outage-s> <prefix> [caches...]` — runs the arms one after another, `FLUSHALL` between them.
- `scripts/analyze.mjs runs/<label>` — builds `truth-table.csv` and `summary.json` for a run.
- `runs/<label>/` — raw evidence per run:
  - `timeline.jsonl` — client-side events (ms epoch `t`): `produce`, `cache.enter/exit` (every cache call), `xadd.enter/exit` (every `RedisStreamsPubSub.publish`, with `budgetExhausted`), `deliver` (separate observer pubsub), `caller.*`, `outage.*`, `console.*`, `drain.done`.
  - `monitor.log` — `redis-cli MONITOR` from inside the container: server-side ground truth for when each EVAL/XADD actually executed.
  - `meta.json` — git head, node, Redis image digest, flags.
  - `console.log` — harness stdout/stderr.

## Setup

```sh
docker run -d --rm --name cor1527-redis -p 6399:6379 redis:8   # disposable; never the shared Factory Redis
cd .artifacts/cor-1527
bash scripts/run-pair.sh plain 300 P2 memory redis
for d in runs/P2-*/; do node scripts/analyze.mjs $d; done
```

The harness refuses to run unless container `cor1527-redis` maps to host port 6399. Arms differ only in `--cache=memory|redis`
(`InMemoryServerCache` vs `RedisServerCache` on an ioredis client, the documented wiring; the transport
`RedisStreamsPubSub` itself uses node-redis). Times in `truth-table.csv` / `summary.json`
are seconds relative to `outage.start`.

Environment: node v22.23.3, redis:8 (8.10.3, digest in `meta.json`), dist built from HEAD a3c08844.

## What is committed

`.artifacts/` is gitignored, so the evidence is force-added. Committed: this README, `REPORT.md`, `scripts/`,
`runs/*/{meta,summary}.json`, `runs/*/truth-table.csv`, `runs/*/console.log`, `runs/*.driver.log`.

Not committed (too large, ~72 MB): the raw `runs/*/timeline.jsonl` (per-event client log) and `runs/*/monitor.log`
(server-side `MONITOR` capture). They remain on the build sandbox under `.artifacts/cor-1527/runs/`; `truth-table.csv`
and `summary.json` are the derived views used in the report.
