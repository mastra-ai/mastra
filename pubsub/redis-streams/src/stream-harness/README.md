# Stream harness qualification

This is test-only qualification of existing behavior, not production repair.
A passing classifier means observations match controls and narrow, ticket-backed
pins; it does not mean the product is fault-free. Unknown behavior, stale pins,
missing captures/cells, infrastructure errors, and cleanup failures must fail.

## Prerequisites

Run from the repository root with the installed pnpm workspace:

```sh
pnpm build:core
# Only needed for Studio readiness; builds its workspace dependencies serially.
pnpm turbo build --filter ./packages/playground --concurrency=1
pnpm --filter ./packages/playground typecheck
```

Fixtures consume public built package exports, not source aliases. Verify imports
without claiming execution coverage:

```sh
(cd pubsub/redis-streams && node test-fixtures/qualification-public-import.mjs)
```

The Inngest tests require the real dev server and CLI. If the CLI is absent,
use the package's opt-in installation:
`pnpm --filter @mastra/inngest setup:inngest-cli`. Existing observe tests alone
are not approval/replay qualification.

## Focused guards

```sh
(cd pubsub/redis-streams && pnpm exec vitest run src/stream-harness/compare.test.ts src/stream-harness/expected.test.ts src/stream-harness/fault-symptoms.test.ts src/stream-harness/normalise.test.ts src/stream-harness/observations.test.ts --maxWorkers=1 --reporter=dot && pnpm run check:test && pnpm run lint)
```

`check:test` excludes `*.test.ts`; it is not a test-file typing guarantee.
Qualification additions require a focused test config that includes changed tests
and checks JavaScript fixtures. Report existing engine skips separately; they
never qualify a required engine.

## Service and process ownership

Run builds, grids, and browser journeys serially. Direct Vitest invocations bypass
package `pretest`/`posttest`; do not assume services are started or cleaned up.
The package's generic `test` script starts/stops Compose and must not be used
against an inherited/shared stack.

For local grids, inspect `pubsub/redis-streams/docker-compose.yaml`, full container
IDs, Compose labels, published ports, and network aliases before startup. Expected
ports: Postgres 5436, Redis 6381, Valkey 6383; Toxiproxy 8474/8661/8663.
Start named services only under a unique owned Compose project. Do not start
redis-cluster (6382/16382), use Redis 6380, stop inherited resources, or kill other
agents' processes. A proxy attached to an isolated Docker network cannot resolve
inherited `redis`/`valkey` aliases: verify the network and both proxied PINGs.
Record and undo only attachments/resources created by the current run, including
partial startup. Port conflicts or ambiguous ownership are blockers, not reasons
to kill an occupant. Cleanup failures fail qualification.

Real cache qualification additionally requires all four explicit fixture inputs:
`STREAM_QUAL_UPSTASH_URL`, `STREAM_QUAL_UPSTASH_TOKEN`, `STREAM_QUAL_CONVEX_URL`,
and `STREAM_QUAL_CONVEX_TOKEN`, plus authorization for dedicated deployments and
run-scoped namespaces. Record only input presence, never values. Missing access
is BLOCKED, never a successful skip. Mock cache guards do not qualify real
Upstash/Convex outages or committed-write/lost-response behavior.

## Evidence contract

Keep raw captures, build/commit provenance, exact commands/exits, cell manifests,
model request/tool-effect counts, identity joins, fault times, terminal/status,
and cleanup results locally outside committed files. Preserve partial captures
on timeout. Keep original observations separate from classification.

Use distinct verdicts: `PROOF: QUALIFIED`, `PROOF: RED` for a reproduced,
attributed product defect, and `PROOF: BLOCKED` for unavailable required evidence.
Report classifier exit separately from product verdict. Browser discovery and
import readiness are not runtime proof. Studio qualification needs the shipped
Stop control, independently measured server termination, persisted reload state,
second-run isolation, video, and trace. Hosted CI is unverified until it runs.

Send evidence to the authorized peer for independent verification/deduplication;
do not repair production behavior or file tickets as part of qualification.
