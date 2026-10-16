# Mastra Code Terminal-Bench snapshot

This branch combines the six reviewed benchmark fixes with the merged BEAM observational-memory fixes. It is a snapshot branch for testing, not a branch to merge into main.

Source is the reviewed `stack/mastra-06-suspension` revision `6a555e5a3a560ea6654ec58ba48bcde8ed63cc4d`, followed by the CI formatting and Factory CLI metadata cleanup from #27322. The headless JSONL documentation includes the final clarification from #26881.

## Included fixes

Benchmark PRs: #26878 (foreground shell default timeout), #26879 (termination escalation), #26880 (stdout drain), #26881 (omit JSONL display snapshots), #26882 (FastEmbed download output), and #26883 (headless suspension lifecycle).

BEAM memory PRs: #25906 (lossless lifecycle), #25998 (commit queue), #22078 (async buffering band), #26129 (chronology), #26149 (buffering markers), #26193 (Observer context option), and #26465 (Reflector fact retention). All seven merge commits are ancestors of this branch. This includes their merged implementations, not the byte-identical October 8 BEAM package snapshot `0.0.0-om-lifecycle-20261008200611`.

The branch predates #27304. That change fixes an auth resource mismatch but introduces a nested goal/subagent thread deadlock reproduced in CLI tests. This snapshot does not include that change and is intended for the standalone Terminal-Bench CLI, not authenticated Factory deployments requiring that fix. It does not claim to fix every known observational-memory issue, including #25372.

## Publication

Use the existing `Publish to npm` workflow, `npm-publish.yml`, with this branch as `ref`, `publish_type=snapshot`, and custom tag `aamish-tbench-20261016`. Do not select `stable`, `prerelease`, or `enter-prerelease`. The snapshot job ignores `dry_run`.

The workflow publishes public immutable npm versions across the workspace under the custom tag. It does not push Git commits or move `latest`, `alpha`, or `next`. It also uploads Studio and Factory assets under the generated CLI version in the existing R2 buckets. Record the matching workflow source SHA, package versions and integrity hashes after publication.

Install only after the workflow succeeds and the required package tags have been verified. Pin the resolved immutable versions for benchmarks, including `mastracode`, `@mastra/code-sdk`, `@mastra/core`, `@mastra/memory`, `@mastra/libsql` and `@mastra/fastembed`. Keep their workspace dependency versions consistent; do not mix this snapshot with the earlier Core 1.74 benchmark installation. A custom tag is a discovery aid, not an immutable benchmark pin.

No benchmark runs, model calls, credentials, traces or datasets are part of this branch. Historical runs remain tied to their original package versions.

## Validation

Validated on an isolated Hetzner checkout with Node 24.18.0 and pnpm 11.21.0, without provider credentials or paid model calls:

- Mastra Code and workspace dependency build passed.
- Core shell/process tests: 334 passed, 2 existing skips.
- Headless SDK: 101 passed. FastEmbed unit tests: 17 passed.
- Memory lifecycle, commit queue, marker and Observer tests: 91 passed.
- LibSQL lifecycle concurrency tests: 16 passed, using real temporary SQLite databases and child processes.
- ACP unit tests: 142 passed.
- Core, Memory, Code SDK and TUI typechecks passed.
- CLI E2E: 226 passed, 14 existing skips on the first run. Two scenarios failed only because the source archive had no Git origin; both passed after adding the canonical origin URL, with no source changes.
- Repository formatting, focused Oxlint/ESLint and changeset package validation passed.
- A separate metadata-only simulation of the workflow produced snapshot versions for all six runtime packages. Packed manifests pinned their internal dependencies to that same snapshot version. The preview tarballs contain metadata only and are not installable builds or published packages.

This is targeted runtime validation, not a claim that every monorepo test or external store integration passed. The publish workflow still performs its own package preflight and build.
