# Mastra Render Sandboxes verification

**All 12 public Sandbox SDK 1.2.0 methods have mapped live evidence. Package publication and catalog submission remain LOCAL.**

The expanded adapter exposes all SDK 1.2.0 sandbox methods and creation options, with compatibility handling for gzip and current HTTPS networking rules. Method coverage does not mean every parameter combination or failure mode has been tested live. This supersedes the earlier intentionally narrow scope and prototype-only command control described in the historical sections below.

## Draft PR branch preparation

The draft branch `feat/render-sandboxes-pr` starts from official Mastra main at `640dc7f24d247f52eb211f4888b41242e75361ec` (core `1.76.0-alpha.5`). It contains the Sandbox integration without the pending Workflows changes. The original `feat/render-sandboxes` branch and its commit `3bfece835a8a5dd771e34fdf619d0308458ccaa5` remain available.

Fresh checks on this base pass: the frozen-lockfile install, all 15 dependency build tasks, 71 unit tests, typechecking, and lint. The regenerated lockfile includes `workspaces/render` and has no `workflows/render` importer. All 13 source files recorded in the previous workspace-packaging hash manifest remain byte-identical. The live API and real-model results below are earlier evidence; this branch-preparation pass did not rerun them or create cloud resources.

[Integration request #26590](https://github.com/mastra-ai/mastra/issues/26590) is still awaiting maintainer triage and approval. The draft does not claim that approval or hosted CI acceptance.

## Mastra workspace packaging, October 9, 2026 Pacific time

Render will maintain the integration inside Mastra. The candidate now uses `@mastra/render` in `workspaces/render`, workspace/core and catalog dependencies, the shared types builder, ESM/CommonJS exports, root pnpm lockfile, existing workspace CI, and a CLI-generated minor changeset. Standalone npm publishing workflows were removed. Mastra's current prerelease plan resolves the first release to `0.1.0-alpha.0`; nothing has been published.

- **Build, lint, formatting and typechecking pass.** The repository build completes all 15 dependency tasks. All 71 unit tests pass on this checkout's workspace core 1.74.0. Frozen lockfile validation passes without changing the file. Changesets recognizes the package and release request.
- **The final archive passes independent ESM, CommonJS and TypeScript checks** on released core 1.67.0 and 1.75.0. Separate installed consumers pass without Workflows and with the provisional Workflows package at its exact 1.67.0 core peer. The archive matches the current `dist` bytes. See [package checks](package-check.json) and [coexistence checks](compatibility.json).
- **A fresh real Claude Haiku 4.5 run passes through the renamed, packed package** on core 1.75.0: four original tests pass, the report is exactly `{"total":42,"row_count":3}`, and SDK cleanup confirms sandbox termination. [Agent record](mastra-package-agent.json).
- **The actual cloud-CI entry point passes against Render:** readiness, binary files, argv/environment, process state, output streams, nonzero exits, output bounds, attached ownership and timeout termination. It explicitly skips when credentials are absent. CI routing discovers the package; the existing trusted job has secret references prepared, but GitHub secrets and hosted runs remain maintainer setup. [Cloud record](mastra-package-cloud.json).
- **Both new sandboxes are independently confirmed terminated.** Together with the earlier audit, 44 recorded sandboxes are terminated and 11 snapshots deleted. Earlier source hashes and live records remain historical; the `workspacePackaging` section of [production-verification.json](production-verification.json) identifies this build.
- **Documentation checks pass:** README contract, focused MDX formatting, Remark, Vale using the existing review config, all 662 frontmatter files, sidebar routing and full production build with VCS metadata disabled in the existing local config. Two unrelated agent-controller anchor warnings and three stale sidebar tags remain. The tracked-manifest peer check validates Render but fails on the pre-existing Workflows core 1.67.0 pin against workspace core 1.74.0. No Workflows or Mastra core code was changed.

The lockfile also records the already tracked private Workflows importer that was absent from the baseline lockfile. This does not add a Sandbox dependency on Workflows. Integration submission and publication remain LOCAL; the dedicated feature issue needs Mastra maintainer feedback before an integration PR. The generic cancellation issue #26580 remains separate.

## Production coverage acceptance, October 9, 2026 Pacific time

- **71 tests pass** on released core 1.75.0 and unmodified source-built official main `918704fd4608aa4d9d90d4d92c0a3429de2b880a` (core 1.76.0-alpha.5). Build and typechecking pass on both. Official main was rechecked during this run and still points to that revision.
- **12 complete live cases pass:** metadata/listing/pagination, command argv/cwd/env and exit status, normal/abort/timeout through Mastra tools, attached cancellation and reuse, native observation-only streaming, 17 MiB binary transfers and local downloads, tar/gzip/local-file uploads, filesystem capture/restore, runtime capture/restore, and Mastra checkpoint capture. [Full evidence](production-live.json).
- **Named restore and seed fallback pass** in a separate two-case live run (checkpoint creation plus restoration). Both the direct SDK snapshot-name path and `clone` fallback restore the expected file. [Evidence](production-focused-live.json).
- **Runtime restore resumes process memory:** a counter process continues incrementing in the restored sandbox. Filesystem restoration preserves file bytes and permission mode 640. Cancellation stops ordinary parent/child processes, prevents delayed writes, preserves unrelated work and leaves the resource usable.
- **Four real agent runs pass:** Claude Haiku 4.5 and Claude Sonnet 4.6 each used generated Workspace command tools on both core versions, repaired the CSV program, passed all four host-restored tests and returned exactly `{"total":42,"row_count":3}`. Model requests went to Anthropic and commands ran in real Render sandboxes; neither boundary was mocked. [Released-core evidence](production-agent-released.json), [current-main evidence](production-agent-main.json).
- **Packed consumer checks pass** standalone on core 1.75.0 and 1.67.0, and alongside the provisional Workflows integration on its exact 1.67.0 peer. [Compatibility record](compatibility.json).
- **Independent cleanup audit passes:** all 42 recorded sandboxes from the expansion, documentation review and operation audit, including failed attempts, are confirmed terminated through the public SDK. All 11 snapshots return SDK 404 after deletion. [Cleanup audit](production-cleanup.json).

The live tests exposed two issues that were fixed before acceptance. The local tar producer could finish and lose unread stdout while remote preparation was pending; it now starts lazily when upload consumes its stream. Render's live service rejected `application/gzip` even though SDK 1.2.0 advertises it; the adapter now streams host decompression and uploads tar. Failed attempts remain recorded in `production-live-attempt1.json` through `production-live-attempt3.json`. Those resources are included in the cleanup audit.

Regression coverage includes shared-start abort races, original authentication/readiness errors, snapshot failures and late receipts, checkpoint/seed/base fallback, malformed gzip, local stream errors, overlapping operations, abandoned iterators, invalid timeout cleanup, natural-exit/cancel races, failed termination confirmation, output bounds and ownership. The [verification manifest](production-verification.json) records source hashes and test versions.

The README and Mastra integration page document the complete API, snapshot ownership, streaming behavior and cancellation modes. Focused formatting, Remark and Vale pass. Frontmatter, sidebar sorting and sidebar coverage validators pass. The full docs build succeeds with Git-history metadata disabled using a temporary config; the original config is unchanged. The aggregate validation command lacks `npm-run-all`, so validators were run individually. Three unrelated stale sidebar tags and two pre-existing broken anchors remain repository-wide merge caveats. The temporary Vale config enabled integration pages because the repository glob currently omits them.

**Remaining upstream issue:** [Mastra #26580](https://github.com/mastra-ai/mastra/issues/26580) can falsely say “killed” when a provider reports unconfirmed termination. This adapter returns affirmative kill flags only after supervisor confirmation, and successful command cancellation passed on affected core versions. The unconfirmed-error path still needs Mastra's generic wording fix. No core fix PR is open or merged. The tested local patch and prior provider comparisons remain below.

## Operation coverage audit

An executable inventory reads the installed SDK declarations and adapter source, then requires a passing live-evidence reference for every public method. It covers **12 SDK methods, 29 adapter methods/accessors and the editor factory**. Run `npm run test:coverage`; the full mapping is in [operation-coverage.json](operation-coverage.json).

| SDK operations                                     | Live evidence                                                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `create`, `get`, `list`, `listGroups`, `terminate` | Creation, attachment, metadata, pagination, explicit owned/attached termination and SDK lifecycle access                         |
| `exec`                                             | Both output streams, nonzero exit, observation cancellation and early iterator close                                             |
| `upload`, `download`                               | String, Buffer, Uint8Array, streams, binary hashes, 17 MiB transfer, tar/gzip, local files/directories and atomic local download |
| `snapshots.create`, `get`, `list`, `delete`        | Direct creation/wait, expiry timestamp, lookup/pagination, filesystem/runtime restoration and independently confirmed deletion   |

Adapter helpers also have live coverage: `start`, `stop`, `destroy`, controlled execution, `writeFiles`, `readFile`, transfer helpers, snapshot capture, `snapshot`, `restore`, `clone`, metadata queries, `sdk`, `getInfo`, `getInstructions` and `renderSandboxProvider.createSandbox`. Clone tests exercise checkpoint selection, seed fallback, fresh-base fallback, environment/cwd overrides and attachment. The configured base-snapshot branch additionally has deterministic regression coverage. Cancellation tests distinguish command termination, whole-sandbox termination and observation-only behavior.

[The new audit](operation-audit.json) has 13 passing assertions: 12 capability cases and one diagnostic that expects the unmodified SDK to fail. The first network probe hit its command deadline because the Python socket timeout did not bound DNS resolution. Its failed record and cleanup remain in [operation-audit-attempt1.json](operation-audit-attempt1.json). The corrected probe bounds the entire request and passes.

The audit found and fixed a missed feature: SDK 1.2.0 sends legacy `allowedDomains`, while Render's live API requires `rules`. The raw SDK request still returns HTTP 400. The adapter now exports typed current network rules and maps legacy domain lists to HTTPS rules through the same public SDK client. It never widens access. Host controls and live sandbox requests verify deny-all, explicit allow-all, allowed HTTPS, a denied destination and blocked HTTP under both adapter input formats. The README and guide document the mapping and HTTPS-only behavior. Public SDK serialization and invalid-policy regressions bring the suite to **71 passing tests on both tested cores**.

Two fresh real-model rechecks pass on the updated build: [Haiku 4.5 on core 1.75.0](operation-agent-released.json), with 10 Workspace calls, and [Sonnet 4.6 on pinned official main](operation-agent-main.json), with nine calls. Both pass four host-restored tests and the exact report check, with independently confirmed termination. The first new Haiku run hit a Render HTTP 429 during artifact download. It is retained as [a failed attempt](operation-agent-released-attempt1.json); a fresh run after the rate-limit window recovered passed. Commands were not automatically retried. Model requests received the synthetic CSV/program/test fixture through the remote shell, without host mounts or host credentials.

The matrix uses cumulative live evidence. It is not a claim that every option combination has a fresh run on the final build. Authentication, interrupted streams, uncertain provisioning, late receipts, races and failed cleanup use deterministic fault injection. Snapshot expiry was set and read back, but automatic expiry was not waited out. Region and plan are exposed, while current early access fixes placement and compute size. Deliberately detached descendants remain outside the process-group cancellation guarantee. Mastra's model-facing tool covers commands; lifecycle, transfer and snapshot APIs were tested directly from the host. Generated REST-only endpoints absent from the high-level SDK are outside this inventory.

Focused Remark and Vale checks and the full docs build pass for the new networking section. The build uses the existing temporary configuration and retains the same two unrelated broken-anchor warnings. The earlier rendered diagram review remains unchanged. Latest resource audit: **42 sandboxes terminated, 11 snapshots deleted**.

## Real-model acceptance matrix

| Model                                          | Released core 1.75.0                            | Official-main core 1.76.0-alpha.5               |
| ---------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | PASS, 8 workspace tool calls, 4 protected tests | PASS, 7 workspace tool calls, 4 protected tests |
| Claude Sonnet 4.6 (`claude-sonnet-4-6`)        | PASS, 6 workspace tool calls, 4 protected tests | PASS, 4 workspace tool calls, 4 protected tests |

These are complete code-repair tasks through `Agent.generate()`, with a failing baseline, host-restored tests and inputs, an independently checked report, and confirmed termination. The Sonnet runs additionally retain Anthropic response IDs, returned model IDs and token usage in the existing agent evidence records. This is two-model Anthropic coverage; other model vendors were not tested. Snapshot, transfer and cancellation feature acceptance is covered separately by the live SDK tests above.

During the follow-up, a source comparison found native-stream timeout validation had moved after operation registration in the main source file. The existing invalid-timeout cleanup regression failed on that source. Restoring validation before registration fixed it. At that checkpoint, both rebuilt distributions matched the earlier tested archive byte-for-byte. All 69 tests, build and typechecking passed again on both core versions. The later networking fix below has its own current source, distribution and archive hashes, 71 passing tests on both cores, and two fresh real-agent runs.

Repeat a real-model run from `workspaces/render` with `RENDER_API_KEY`, `RENDER_WORKSPACE_ID`, and `ANTHROPIC_API_KEY` set in the environment:

```sh
MODEL=anthropic/claude-sonnet-4-6 EVIDENCE_DIR=validation/real-sonnet46-artifacts pnpm example
```

The pinned-main run used the separately built consumer recorded above; that ignored local build fixture is not included in the repository.

## Guide and README review

Reviewed both documents against the adapter, public SDK 1.2.0 reference, live evidence and the local technical guide standard. Corrected the missing local archive installation/run path, compatibility scope, model/data flow, cleanup failure wording, direct SDK lifecycle reconciliation and snapshot cleanup. Added creation constraints, missing provider options and clear boundaries between host credentials, model requests and sandbox execution.

Copied the agent and snapshot examples from both documents into an independent npm consumer of the packed archive. Resolved the guide's Sonnet model token and added assertions and evidence capture without mocking model or Render calls. Both examples typecheck and pass with real Claude Sonnet 4.6: the agent uses the Workspace command tool, the host independently confirms `42`, snapshot restore contains `hello.mjs`, both source and restored sandboxes terminate, and snapshot lookup returns 404 after deletion. These four additional sandboxes and two snapshots are included in the aggregate cleanup audit. The `documentation` section of [the existing manifest](production-verification.json) retains provider response IDs, resource IDs, hashes and cleanup confirmations.

Focused MDX/README formatting, Remark, Vale and all 662 frontmatter checks pass. The production docs build passes using the existing temporary config with Git-history metadata disabled; its two unrelated agent-controller anchor warnings remain. The generated page was checked in Chrome at 1365 px and 390 px widths: no JavaScript errors, unresolved model tokens or page overflow. The original horizontal diagram was unreadable on phones, so it now uses a vertical layout. Both rendered diagrams were visually inspected. Authored links open in a new tab with `noopener noreferrer`. Local render evidence is in `validation/docs-artifacts/guide-rendered.json` and the screenshots beside it.

The repository's `pnpm exec` attempted automatic workspace installation before running the requested tools. It was stopped, the 85 npm-installed packages it moved aside were restored without overwriting existing packages, and the checks ran through the installed binaries. No tracked lockfile changed.

## Historical verification and provider comparisons

The following records describe the initial adapter and subsequent diagnosis before the coverage expansion. Earlier counts and cancellation behavior are historical; the acceptance results above describe the current implementation.

**Freshness correction:** Initial source research used the October 1 fork commit `14613e73a5`, not official current main. The follow-up first compared `6c9ad808c8`, then pinned `918704fd4608` at the start of the runtime verification. The current-main findings below replace the earlier NOT YET VALIDATED status; they do not erase the reporting defect.

## Current-main verification

The official source archive was downloaded at the exact pinned commit, installed using its frozen lockfile and supply-chain checks, built with the repository's core build pipeline (14 tasks passed), and packed with its source-built schema dependency. The archive and core tarball hashes are in [upstream-current.json](upstream-current.json). An isolated consumer used only those public package exports and SDK 1.2.0, without Workflows. No modified core was used for the agent or live cancellation runs.

The public sandbox interface, command/result types, lifecycle contract, Workspace exports and editor provider types remain byte-identical to the original checkout. The current source has no Render Workspace provider or sandbox catalog entry. The existing deployment listing serves a different use case. The adapter's 46 tests, build and example/script typechecks passed against the actual current-main build.

The real agent used the built-in command tool eight times, repaired the program, passed four restored tests and produced exactly `{"total":42,"row_count":3}`. Sandbox `sbx-18p4gdb4lods9v7es73a9uibg` was independently confirmed terminated at `2026-10-09T21:27:52.06335Z`. [Current-main agent record](upstream-agent-result.json).

Live cancellation proved both ownership paths: an attached command continued and wrote its marker after cancellation, while an owned command's abort terminated its sandbox. The attached tool output nevertheless claimed it was killed. Both resources were cleaned up. [Live cancellation record](upstream-cancellation.json).

The provider-independent `npm run test:cancellation` reproduces that false claim using only public Mastra APIs, without Render credentials. It fails on published core 1.75.0 and unmodified main, passes on core 1.67.0, and passes on a separately rebuilt and packed candidate fix. The [patch](../docs/upstream-cancellation.patch) makes unknown termination neutral and retains killed wording only for `killed: true`. All 55 focused upstream command-tool tests pass. The proposal was applied only in an ignored source-build fixture; the original checkout's core is unchanged. See [maintainer handoff](../docs/UPSTREAM.md).

The package peer range remains on released versions below 1.76.0. The main build is a compatibility probe, not a published dependency. Workflows pins core 1.67.0 exactly, so coexistence is verified at that shared release; current-main Workflows compatibility is not claimed.

## Initial cross-check with other Mastra providers

Tested source-built `@mastra/modal` 0.7.1 from the same upstream commit with published core 1.75.0, Modal SDK 0.10.1 and Vitest 3.2.4. Three diagnostic cases passed: a normal Modal command control, reproduction of incorrect Modal cancellation metadata, and live LocalSandbox cancellation. Passing diagnostic assertions means the defect was reproduced, not that Modal cancellation is correct.

The Modal adapter and Mastra command tool ran unchanged. Only the Modal SDK boundary was substituted with a real local child process and readable streams. After abort, the adapter canceled two readers, returned `killed: true` and exit code 137, and the tool claimed the command was killed. The process was still alive when the tool returned, then wrote its marker and exited normally with code 0. No termination call occurred before workspace destruction. This establishes an adapter-level defect under the SDK contract; it is **not a live Modal cloud-service test**.

A separate live `LocalSandbox` control used real OS processes without provider mocking. The tool reported `killed: true`, the process no longer existed, and its delayed marker was never written. All local child processes exited or were terminated and their workspaces were destroyed. No new cloud resource was created for this cross-check. At that stage Modal credentials were absent and Docker's daemon was unavailable. Both were subsequently live-tested below.

The Modal defect is related to the Render finding but is at an additional layer: it supplies incorrect `killed: true` metadata. The proposed shared-tool fix cannot correct a provider's affirmative but inaccurate kill claim. Report this as a separate Modal adapter issue when preparing upstream review, keeping this initial controlled test distinct from the later live cloud verification below.

[Sanitized evidence](other-provider-cancellation.json) and [executable test](../scripts/other-provider-cancellation.test.mjs). The isolated fixture is `validation/other-providers-artifacts`; its Vitest config inlines `@mastra/modal` so the SDK boundary mock applies. Run `node_modules/.bin/vitest run --config vitest.config.mjs` there. The fixture installs source-built Modal and published core 1.75.0, satisfying the provider's peer range. The main alpha is excluded by that peer range and was not forced into this check.

## Live Docker follow-up

Docker Desktop was installed but stopped. Starting the existing installation enabled a real local test with source-built `@mastra/docker` 0.10.0-alpha.1 from the pinned upstream revision and published core 1.75.0. Docker Engine was 29.7.2. The existing `node:22.22.0-bookworm-slim` image was pinned by its local image ID. No image download, host mount, provider mock or cloud credential was needed; the test container had networking disabled.

Three cases passed: normal completion, abort and command timeout. Each command spawned a child process. Abort and timeout removed both parent and child, prevented their delayed marker files, and left the container usable. The generated tool correctly reported `killed: true`. Normal completion produced both files and exit code 0.

`workspace.destroy()` removed the test container. The Docker API returned 404, then an independent CLI check confirmed the ID no longer existed and no matching container name remained. Docker Desktop remains running; unrelated containers were not stopped or removed. Apple's `container` CLI was absent, so no Apple Container runtime test was performed.

[Docker evidence](docker-cancellation.json) and [executed script](../scripts/docker-cancellation-live.mjs). Reproduce from the existing `validation/other-providers-artifacts` fixture with `node docker-cancellation-live.mjs`; the default image ID and socket refer to this tested Mac.

The observed cancellation results are now:

| Provider              | Test method                                               | Result                                                                        |
| --------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Render attachment     | Real cloud sandbox                                        | Shared Mastra tool falsely claims killed                                      |
| Modal                 | Real cloud sandbox, following the initial controlled test | Abort falsely reports killed; command timeout also leaves remote work running |
| Daytona               | Real cloud sandbox                                        | Correct termination and reporting, including child processes                  |
| LocalSandbox          | Real local OS process                                     | Correct termination and reporting                                             |
| Docker                | Real local container                                      | Correct termination and reporting, including child processes                  |
| Mastra hosted sandbox | Not tested                                                | Unknown                                                                       |
| Apple Container       | CLI absent                                                | Not tested                                                                    |

These results do not support a blanket distinction between third-party and Mastra-owned providers.

## Live Modal follow-up

The same source-built Modal adapter 0.7.1 and published core 1.75.0 were tested against the actual Modal cloud service using JavaScript SDK 0.10.1. There were no provider or SDK mocks. The sandbox used `python:3.13-slim`, a five-minute maximum lifetime, no mounted volumes and no injected credentials. Commands spawned a parent and child that each wrote a file after three seconds. A separate ModalClient observed their PIDs and files.

- Normal completion passed: exit code 0 and both files appeared.
- Abort reproduced the defect in the cloud: the adapter returned `killed: true`, exit 137, and the tool said the command was killed after 81 ms. Independent observation found both processes still alive with no files yet. Both files appeared afterward.
- A one-second command timeout also failed to stop the remote work. The tool returned exit 1 after 1,004 ms without `timedOut` metadata. Both processes were alive immediately afterward and later wrote their files. The original automated classifier labeled this case inconclusive because no affirmative killed flag was present. Review of the saved observations establishes continued remote work, while responsibility for timeout enforcement across the SDK/server boundary remains unisolated.

Sandbox `sb-fuPahYsUSpfVpfkQ1n2Os1` was independently confirmed terminated with exit code 137 at `2026-10-09T22:35:52.184Z`. Cleanup called workspace destruction and, after an immediate poll still showed running, SDK `terminate({ wait: true })`. This sequence does not prove the first asynchronous termination failed. No live test sandbox remains running. Credentials stayed in host process memory and were not saved to a profile, evidence, source file or sandbox environment.

The abort finding is now live-confirmed in Mastra's Modal adapter; it is not a Render-specific defect. The generic core wording proposal alone cannot correct Modal's false affirmative `killed: true`. No Modal adapter or SDK code was changed. [Live evidence and review](modal-cancellation-live.json) and [executed script](../scripts/modal-cancellation-live.mjs). The script runs from the existing `validation/other-providers-artifacts` consumer using local Modal authentication; its hash and the provider archive hash are recorded in the evidence.

## Live Daytona follow-up

Source-built `@mastra/daytona` 0.11.2 from the same pinned official revision was tested against the real cloud service with published core 1.75.0 and the adapter's SDK dependency `@daytonaio/sdk` 0.201.0. All 17 upstream build tasks passed; public imports and dependency deduplication passed. The adapter and SDK ran unchanged, without mocks. The default Python snapshot provided 1 CPU, 1 GiB memory and 3 GiB disk. The sandbox was private, ephemeral, blocked outbound network access, and used a two-minute idle auto-stop plus deletion on stop as a cleanup backstop.

All three behavior cases passed:

- Normal completion returned exit 0 and produced both expected files.
- Abort returned exit 137 with `killed: true` and `timedOut: false`. A separate SDK client confirmed both parent and child were absent immediately afterward and no delayed files appeared.
- A one-second timeout returned exit 124 with `killed: true` and `timedOut: true`. Both processes were absent and neither delayed file appeared. The sandbox remained usable after both cancellation cases.

The first probe exited 1 during cleanup verification: the immediate ID lookup and label-filtered list did not yet both confirm deletion. This was retained in the evidence. A fresh independent audit at `2026-10-09T22:43:20.978Z` returned `DaytonaNotFoundError` for sandbox `fcf0d9d1-bc29-401a-b683-0d5d41186933` and no matching sandbox in the filtered list. The audit exited 0, confirming deletion. The first probe is not described as a clean exit.

[Daytona evidence](daytona-cancellation-live.json), [executed live probe](../scripts/daytona-cancellation-live.mjs), and [independent cleanup audit](../scripts/daytona-cleanup-audit.mjs). Both scripts run from the existing `validation/other-providers-artifacts` consumer with `DAYTONA_API_KEY` in the host environment. The audit reads the existing evidence and checks only its sandbox ID and unique label. The key was not persisted or passed into the sandbox. No adapter fix, upstream issue or external submission was made.

Daytona provides a passing third-party cloud control. The observed problematic integrations remain Render attachment/shared-tool reporting and Modal adapter cancellation; this is not a universal third-party sandbox failure.

## Why Docker and Daytona succeed, and the Render adapter does not yet match them

The earlier comparison needs a scope correction: Render's owned-sandbox cancellation already passed by terminating the entire sandbox. The failing live case attached to an existing sandbox; our adapter preserved it, stopped observing, and left the command running. Mastra then incorrectly described that error as a confirmed kill. This combines a deliberate limitation in our current adapter with a separate upstream reporting bug.

Docker's adapter wraps each command in a dedicated process group with `setsid`, records the group ID, executes a second command to stop/kill that group, and verifies termination before reporting `killed: true`. It does not depend on a native per-exec kill endpoint. Daytona's adapter creates a dedicated session and calls `deleteSession()` on cancellation; the live checks confirmed parent and child termination on that normal path. Daytona's implementation catches session-deletion errors, so the successful test does not establish correctness when deletion fails.

Our current Render adapter implements neither process-group tracking nor a command-specific termination helper. Its request AbortSignal only cancels the request/stream, as documented by [Render's SDK reference](https://render.com/docs/sandboxes-sdk-typescript). Ownership protects the whole attached sandbox; it does not prohibit stopping commands the adapter itself launched. Absence of a native command-kill SDK method is not proof that shell-based command cancellation is impossible.

A live feasibility probe implemented the Docker-style approach using only public Render SDK `exec()` and the public Mastra WorkspaceSandbox tool interface. On unpatched core 1.75.0 and SDK 1.2.0, normal completion, abort and timeout all passed. Abort and timeout stopped the parent and child, prevented delayed files, preserved an unrelated concurrent command, and left the sandbox running. The tool received confirmed kill metadata and reported it accurately. The actual `setsid`-wrapped exec returned code 9 on forced termination; this observed value was preserved, not replaced with a fabricated 137 or 124.

Sandbox `sbx-18p4gdb4n6d67bikc73fg4eqg` was confirmed terminated at `2026-10-09T23:05:42.619225Z`. [Live feasibility evidence](render-process-control-probe.json) and [executed probe](../scripts/render-process-control-probe.mjs). Run with existing Render authentication using `node --import tsx scripts/render-process-control-probe.mjs` from this package.

**Decision:** Implement and verify command-level process control in our adapter if parity with these cancellation paths is required. Keep the generic Mastra reporting correction for unconfirmed termination/error cases. The probe is not integrated into the adapter and does not change the current limitation. Production work must cover unavailable `setsid`, startup/natural-exit races, process identity reuse or tampering, failed kill requests, bounded cleanup and descendants that deliberately leave the group. The tested ordinary-child case does not prove arbitrary process-tree containment.

## Architecture and changed files

The external `@renderinc/mastra-sandbox` package implements public `WorkspaceSandbox`. A real `Agent` receives Mastra's generated shell tool through a static `Workspace`. No Mastra core source was changed. Native upload/download helpers seed and retrieve files; shell commands provide file work during an agent task. This does not claim `WorkspaceFilesystem` support.

- `src/sandbox.ts`: owned creation, bounded readiness, attachment, command streaming, shell quoting, file transfer, ownership-sensitive disposal and retained cleanup information.
- `src/provider.ts`, `src/index.ts`, `src/errors.ts`, `src/utils.ts`: public provider descriptor/exports, typed error codes, finite deadlines and bounded UTF-8 output.
- `src/sandbox.test.ts`, `src/sdk-contract.test.ts`, `src/workspace-tools.test.ts`: deterministic lifecycle/behavior, actual SDK SSE parsing, and public generated-tool ownership/error tests.
- `package.json`, lockfile, TypeScript/Vitest configuration, license and gitignore: a private, independently installable ESM package, compiled declarations and repeatable checks.
- `examples/code-repair/`: executable real-agent example, deliberately broken program, CSV data, four original tests and an independent host-provided verifier.
- `scripts/`: live operation checks, terminal-state confirmation, packed consumer checks and a local credential launcher. The launcher reads existing credentials into a child environment and does not copy or print them.
- `README.md`, `docs/RESEARCH.md`, `docs/UPSTREAM.md`: quickstart, pre-implementation research gate and maintainer handoff.
- `docs/src/content/en/integrations/sandboxes/render.mdx` and its existing `sidebars.js` in the repository: integration page and one canonical catalog entry. No duplicate provider registry.

## Public APIs and Workflows boundary

Mastra imports use `@mastra/core/agent`, `@mastra/core/workspace` and `@mastra/core/editor`, including `WorkspaceSandbox`, `SandboxProvider` and related public types. Render uses `new Render(options).experimental.sandboxes` with `create`, `get`, `exec`, `upload`, `download`, `terminate` and `list`. Backend code was inspected only as research evidence. No private endpoints or backend imports are used.

The existing Workflows integration is private `@renderinc/mastra` 0.0.0 with public SDK 1.2.0 and public core 1.67.0. The sandbox package reuses the SDK version and its public constructor/authentication configuration convention. It accepts a shared host client. The SDK already supplies environment fallback, so no new shared authentication helper is needed. There is no Workflows import, worker, transport or workflow service requirement. Workflows PR 25515 remains open and unmerged.

## Deterministic and dependency checks

**46 tests passed in three files:** 38 provider cases, four contract cases using the real public SDK's HTTP/SSE handling with stubbed fetch, and four generated Workspace tool cases. The separate strict cancellation-reporting reproduction fails on affected core as described above, so this count is not a claim that upstream reporting is correct. Covered creation/readiness deadlines, uncertain and late provisioning, stdout/stderr/callbacks, nonzero exit, interrupted streams, UTF-8 truncation, shell quoting, file transfers/limits, cancellation, authentication failure, attachment, concurrency and cleanup retries.

`npm run typecheck`, `npm run build` and `npm pack` passed. The example and live scripts are included in typechecking. The package exports built JavaScript and declarations and was imported from its local npm archive.

| Packed consumer    | Public core | Workflows                                  | Outcome                                         |
| ------------------ | ----------- | ------------------------------------------ | ----------------------------------------------- |
| Standalone current | 1.75.0      | Not installed or resolvable                | Import, Workspace lifecycle and TypeScript PASS |
| Standalone minimum | 1.67.0      | Not installed or resolvable                | Import, Workspace lifecycle and TypeScript PASS |
| Coexistence        | 1.67.0      | Local Workflows archive installed/imported | Import, Workspace lifecycle and TypeScript PASS |

All use SDK 1.2.0. `npm ls` confirms SDK and core deduplicate in the coexistence installation. Consumer lifecycle checks use a stubbed public SDK client; the independent standalone acceptance test below uses the real service. This does not claim live Workflows execution was tested. [Machine-readable compatibility results](compatibility.json).

## Real agent and sandbox evidence

Final documented example: `npm run example`, executed with public core 1.75.0, SDK 1.2.0, and `anthropic/claude-haiku-4-5-20251001`. Model calls run on the host. The sandbox has explicit deny-all egress and a 900-second lifetime.

- Sandbox: `sbx-18p4gdb4jmk49v7es738bfug0`.
- Observed states: `running`, then `terminated`.
- Original broken program: test exit code 1.
- Real agent used `mastra_workspace_execute_command` eight times to inspect files, repair the program, run tests and create a report.
- The host restored the original tests and input, then independently reran all four tests and a separate verifier.
- Exact downloaded result: `{"total":42,"row_count":3}`. Four tests passed. Corrected source was downloaded before cleanup.
- Terminal timestamp: `2026-10-09T19:07:20.97471Z`.

[Final agent record](agent-result.json). The first attempt repaired the code but produced a test-summary JSON instead of the required report. Verification correctly rejected it. The prompt was clarified with the exact report contract and command; the verifier was not weakened. Two subsequent live agent runs passed. [First-attempt failure evidence](agent-first-attempt.json).

A separate live suite verified binary transfer and permissions, literal argv and env values, persisted files versus fresh shell state, stdout/stderr with exit 7, output truncation, attachment without ownership transfer, and owned timeout cleanup. [Operation evidence](operations.json).

## Cleanup of live Render resources

An independent query for the initial seven Render sandboxes at `2026-10-09T21:31:26.445Z` through SDK `sandboxes.list` confirmed all seven task-created Render resources have status `terminated` and a termination timestamp. This includes the failed first agent attempt. No test sandbox is left running. [Initial public-API cleanup audit](cleanup.json). The eighth resource, created for the later process-control probe, was independently confirmed terminated in [that probe record](render-process-control-probe.json).

| Sandbox ID                      | Final state | Terminated at (UTC)         |
| ------------------------------- | ----------- | --------------------------- |
| `sbx-18p4gdb4jmk49v7es738bfug0` | terminated  | 2026-10-09T19:07:20.97471Z  |
| `sbx-18p4gdb4jj97f3r2c739op6ag` | terminated  | 2026-10-09T19:00:12.608815Z |
| `sbx-18p4gdb4jhrd9fdbs73fhcun0` | terminated  | 2026-10-09T18:57:11.709974Z |
| `sbx-18p4gdb4jhjjncjis73fp9770` | terminated  | 2026-10-09T18:56:21.935534Z |
| `sbx-18p4gdb4lods9v7es73a9uibg` | terminated  | 2026-10-09T21:27:52.06335Z  |
| `sbx-18p4gdb4log7f3r2c73a087gg` | terminated  | 2026-10-09T21:27:33.512666Z |
| `sbx-18p4gdb4lohij9qps73d1mas0` | terminated  | 2026-10-09T21:27:35.819614Z |
| `sbx-18p4gdb4n6d67bikc73fg4eqg` | terminated  | 2026-10-09T23:05:42.619225Z |

## Discovery and documentation checks

Browser verification started on the built generic `/docs/sandbox/overview`, at the developer need for isolated execution. Its remote-sandbox grid contains Render. Following that entry opens `/integrations/sandboxes/render`, explains the local unpublished status, identifies credentials, and starts with `npm ci --workspaces=false`, `npm run build`, and `npm run example`. The source page, actual output and diagram were inspected in the browser at desktop and 390-pixel width. Labels, arrows and boxes are readable without overlap.

Frontmatter validation passed all 662 files. Reference-sidebar ordering and sidebar membership passed. The new page passed MDX formatting, Remark and the repository's Vale error-level rules. The existing Vale glob excludes integration pages, so a temporary validation config extended only that glob while keeping the same rule set. `git diff --check` and a credential-pattern scan passed.

The full docs build generated 944 HTML pages and 944 machine-readable pages, including the Render page. Its sitemap Git-history lookup stalled on Node 24; the Node 22 retry exposed the cause: the partial clone attempted to fetch a missing history object from the fork, and GitHub returned HTTP 502. The normal full build is not recorded as passing. A complete local build then exited 0 with the supported `future.experimental_vcs: false` option in a temporary config, which was removed afterward. This omits Git timestamps without disabling compilation, sitemap generation or link checks. The normal repository config is unchanged. Reproduce this check with a temporary config beside `docs/docusaurus.config.ts` that imports it and overrides only `future.experimental_vcs: false`, then pass it to `npm run build -- --config <temporary-config>` and remove the temporary file. The successful build also reported two pre-existing anchor warnings from `/docs/harness/agent-controller` to the session reference. Saved logs are in ignored `validation/docs-artifacts/`. The repository's separate stale-navigation-tag check also fails on three pre-existing tags dated August 19, August 27 and September 8. No unrelated docs or toolchain changes were made. These repository-wide checks need resolution before an upstream docs merge.

**Upstream placement remains LOCAL.** No package publication, upstream PR modification, message, sharing change or deployment occurred. [Maintainer handoff](../docs/UPSTREAM.md) identifies package ownership/release-process decisions and replacing local instructions with actual published URLs. Canonical Mastra discoverability is not claimed until upstream acceptance.

## Current limits relevant to adoption

- The SDK's experimental sandbox client has no native pause/resume, individual-command kill, interactive stdin, preview URL or mount methods. Command-level control is supplied through public exec and requires Linux, Python 3, bash and `/proc` in the image.
- Process groups stop ordinary descendants but cannot guarantee containment of deliberately detached sessions. Explicit whole-sandbox termination mode is available for a dedicated owned resource.
- `WorkspaceFilesystem`, an interactive process manager and code-mode transport are separate Mastra interfaces and are not advertised. Agent filesystem work uses shell commands; all public SDK transfer and snapshot methods are exposed.
- Downloads are buffered by the SDK, and transfers can leave partial remote files on failure. Snapshot captures and ordinary file mutation require caller coordination when application-level consistency matters.
- Control-plane calls lack native abort and creation idempotency. Unknown acceptance is retained, never retried automatically or described as confirmed cleanup. The configured server lifetime is only a backstop.
- Publication still requires package ownership, final namespace and release-process decisions. The local private package is not an npm release or accepted Mastra catalog entry.

The adapter work and live acceptance are complete. The separate core wording issue, publication decisions and unrelated repository docs checks remain visible in the [maintainer handoff](../docs/UPSTREAM.md).
