# Experiment Worker E2E Matrix — Goal-Plan Handoff

## Status

This document is the finalized research and decision handoff for drafting a goal-ready implementation plan. It is not itself the executable goal plan.

The goal-plan draft should be created under `.mastracode/plans/` and follow the goal-ready plan rubric: phased commits, a baseline phase, exact verification gates, progress and amendments sidecars, judge stop points, live proof, adversarial review, and a final human approval gate.

## Objective

Add a committed, reusable experiment-worker E2E system that installs representative customer projects from packaged Mastra releases, runs `mastra experiment build`, validates and relocates the artifact, launches it as a fresh standalone process, exchanges protocol-v1 NDJSON, and verifies behavior, persistence boundaries, portability, shutdown, and resource cleanup across representative project shapes.

The system must provide:

- A small deterministic subset suitable for normal pull-request CI.
- A larger, fully automated matrix runnable locally, on demand, and on a schedule.
- Credential-gated scenarios that skip clearly when infrastructure is unavailable.
- Repository-owned fixtures and diagnostics so supported-contract failures become durable regressions rather than one-time dogfood findings.

## Authoritative implementation direction

Create an independent external E2E suite at:

```text
e2e-tests/experiment-worker/
```

The suite should:

1. Reuse the repository's shared Verdaccio publish-once/test-many infrastructure.
2. Consume actually packed and published workspace packages rather than treating workspace links as the authoritative E2E mode.
3. Install customer projects in isolated package-manager roots.
4. Run the built `mastra` CLI as a customer would.
5. Execute every generated worker in a fresh child process.
6. Keep detailed protocol transcripts, process diagnostics, and machine-readable matrix results.

Workspace linking may be offered as an optional fast local-development mode, but Verdaccio-installed packaged artifacts are the acceptance path.

## Why this architecture

The repository already has the required foundations but no experiment-worker orchestration layer:

- `.github/workflows/e2e-tests.yml` builds and publishes packages once to temporary Verdaccio storage, uploads the registry, and fans out independent Linux fixture jobs.
- `e2e-tests/_local-registry-setup` supports both local publication and CI consumption of a pre-published registry.
- `e2e-tests/create-mastra` demonstrates installed temporary projects, exact published versions, detached process trees, diagnostics, bounded shutdown, and cleanup.
- `e2e-tests/monorepo` demonstrates strict-pnpm workspaces, signal handling, process tracking, serialized conflicting work, and retried cleanup.
- `e2e-tests/no-bundling` demonstrates expensive-build memoization, generated manifest assertions, subprocess diagnostics, timeouts, and forced cleanup.
- `e2e-tests/commonjs` demonstrates compact install/build/execute/remove fixture lifecycles.
- Package-local CLI tests already cover fast protocol and runtime mechanics.

An external Verdaccio-backed suite matches the product boundary: customer package installation, `#mastra` loading, bundling, dependency installation, artifact relocation, and fresh-process execution. Package-local tests should continue to own low-level protocol mechanics.

## Coverage model

Split coverage into four layers to avoid an unmaintainable Cartesian product.

### 1. Project-shape coverage

Prove:

- Package-manager installation and dependency layout.
- Customer `#mastra` module loading.
- Mastra construction and registration.
- Dependency discovery and optimization.
- Native external handling.
- Generated dependency manifests and install policy.
- Artifact manifest correctness and portability.

### 2. Experiment behavior

Prove:

- Agent execution, tool mocks, deny policy, versions, memory, and workspaces.
- Workflow execution, request context, suspend/resume, and failure serialization.
- Scorer resolution, output consumption, failures, and counters.
- Workspace and sandbox behavior that import-only tests cannot exercise.
- Worker-side experiment and score persistence remain disabled while customer state remains functional.

### 3. Protocol coverage

Keep most transport mechanics in the existing fast package-local suites. External E2E should repeat only behavior that depends on a real generated process or artifact:

- Real stdin/stdout framing through a child process.
- Cancellation and deadline behavior.
- Stdout/stderr isolation.
- Natural process exit and terminal/exit-code agreement.
- Truncated input and abrupt termination recovery.
- Backpressure only where a spawned artifact adds meaningful coverage.

### 4. Fresh-process coverage

Prove:

- Success followed by success.
- Failure followed by success.
- Cancellation followed by success.
- Artifact execution after copying to a different absolute path.
- Execution without source-workspace resolution.
- Minimal production-like environment.
- Two workers sharing one immutable artifact.
- Abrupt termination followed by a clean new process.
- No leaked subprocesses, ports, locks, handles, containers, or temporary directories.

## Reachability boundaries

The goal plan must preserve these architectural facts:

- Worker startup imports the complete customer `#mastra` module. Every configured component can affect bundling, initialization, environment loading, native dependency handling, and shutdown even when it is not selected as the experiment target.
- Agent experiments directly reach tools, tool mocks, deny policy, request context, cancellation, agent versions, memory, workspace, skills, browser, processors, and model resolution.
- Workflow experiments directly reach input, request context, and suspend/resume data. Protocol cancellation can terminate the overall run, but the experiment executor does not currently pass the cancellation signal, agent version overrides, or tool policy directly into `executeWorkflow`; tests must distinguish outer worker cancellation from workflow-native signal propagation.
- Scorers run after targets and can add model, storage, tracing, request-context, and packaging failures.
- `mastra.shutdown()` destroys registered workspaces before storage and observability shutdown. Lifecycle verification is part of correctness.
- Workspace initialization, sandbox startup, skills, mounts, search, LSP, browser, cancellation, and cleanup require runtime coverage; successful import is insufficient.

## Fixture strategy

The target is approximately 12 supported project shapes, not 12 unrelated dependency trees.

Use:

- A broader pnpm runtime matrix where multiple isolated Mastra entrypoints share an install only when the tested difference is runtime configuration.
- Separate install roots when the tested dimension changes package resolution or installation semantics.
- Minimal npm and Yarn Berry fixtures for package-manager-specific coverage.
- A separate pnpm monorepo fixture.
- One kitchen-sink compatibility canary.

### Dimensions that may share a pnpm runtime fixture

- Agent versus workflow target.
- Tool-mock behavior.
- Scorer success or failure.
- Workspace inheritance versus agent-owned override.
- Request-context variation.
- Cancellation and lifecycle behavior where dependencies are unchanged.

### Dimensions that require isolated install roots

- npm versus pnpm versus Yarn.
- Strict pnpm versus hoisted dependency layout.
- `allowBuilds` or `onlyBuiltDependencies` configuration.
- Transitive native dependencies such as DuckDB.
- pnpm monorepo and local workspace packages.
- Dependency graphs whose packaging behavior is itself under test.

Copied-artifact execution uses a fresh execution directory; it does not necessarily require reinstalling the source fixture unless installation layout is the tested dimension.

## Required project shapes

The goal-plan phases should cover these project shapes through focused fixtures and entrypoints:

1. Minimal npm agent — baseline build, run, terminal, and shutdown.
2. Tool-using agent — real core tool mocks, argument matching, exhaustion, and deny policy.
3. Stateful agent — memory, storage, vector behavior, and persistence separation.
4. Resumable workflow — multi-step execution and suspend/resume data.
5. Agent/workflow with multiple scorers — resolution, async scoring, failures, and counters.
6. Global local workspace — inheritance, filesystem, and real skills.
7. Agent-owned workspace plus global workspace — precedence and cleanup.
8. Dynamic request-context workspace — isolation, concurrency, and cancellation.
9. Local sandbox workspace — command execution, subprocess cancellation, and shutdown.
10. Strict-pnpm native project — symlinks, configured external dependencies, native packaging, and artifact relocation.
11. pnpm workspace/monorepo — local package packing and workspace resolution.
12. Yarn Berry project using the `node_modules` linker — alternate installation and import-heavy compatibility.

True Yarn PnP and Bun are not part of the initial goal unless separately authorized.

## Workspace and sandbox priority

Workspaces and sandboxes are the highest-priority behavioral area. Keep scenarios separately attributable rather than collapsing them into one kitchen sink.

Required scenarios:

1. Global workspace inherited by an agent.
2. Agent-owned workspace overriding the global workspace.
3. Dynamic workspace selected through request context.
4. Filesystem plus a real `SKILL.md`.
5. Filesystem plus BM25 search.
6. Filesystem plus vector search and an embedder.
7. Local sandbox command execution and cancellation.
8. Sandbox plus LSP startup and cleanup.
9. Lazy browser startup and cleanup.
10. Mount-backed workspace with multiple mount points.
11. Concurrent items using distinct dynamic workspaces.
12. Workspace initialization failure followed by complete cleanup.

Provider coverage should sample behavior classes rather than every vendor:

- Host filesystem.
- Object-store filesystem.
- Local subprocess sandbox.
- Container-native sandbox.
- One remote container or MicroVM provider.
- One hosted/platform proxy provider.

Only local providers are required in normal OSS acceptance. Credential-backed providers are automated but gated.

## Required behavioral assertions

### Agents

- Successful strict mock and `matchArgs` behavior.
- Mock mismatch, exhaustion, and undeclared-tool rejection.
- Fresh mock state between dataset items.
- Versioned agent selection.
- Request-context-dependent workspace, tool, or model resolution.
- Cancellation during generation.
- Cancellation during sandbox or tool execution.
- Memory read/write through real storage and vector components.
- Agent-owned workspace precedence.

### Workflows

- Multi-step success.
- Request-context propagation.
- Suspend/resume with flat data.
- Step-specific resume data.
- Cancellation during an active step.
- Workflow failure serialization.
- Scorer consuming workflow output.

### Scorers

- Multiple scorer IDs.
- Async scorer.
- Scorer exception after a successful target.
- Request-context-dependent scorer.
- Scorer with a packaging-sensitive dependency.

### Persistence

- Protocol-supplied experiment ID remains visible to execution.
- Worker calls `runExperiment()` with experiment and score persistence disabled.
- Agent memory and customer workflow-owned state still persist where expected.
- No experiment or score records are written to customer storage.
- A second fresh process can immediately reuse the database.

## Database coverage

Test database behavior classes, not every adapter.

### Required locally or in deterministic CI

- LibSQL/SQLite:
  - File-backed customer state.
  - Real memory or workflow-owned reads/writes.
  - Database-level proof that experiment and score records are absent.
  - Repeated runs proving file handles are released.
- DuckDB/native analytical dependency:
  - Native external packaging and declaration.
  - Artifact build and local runtime.
  - No need to duplicate the complete memory scenario unless DuckDB is intentionally used as customer storage.
- One real vector adapter:
  - Actual insert/query behavior in the stateful-agent or workspace-search scenario.

### Required full-matrix service-backed coverage

- Postgres:
  - Networked credentials and connection pool initialization.
  - One stateful agent or workflow scenario.
  - No experiment persistence.
  - Natural connection shutdown and immediate reuse.

Postgres is required before review or release, but may run as a Docker-backed scheduled or manually dispatched automated job rather than on every push.

Other adapters generally receive their own package integration tests and build/import coverage unless they have materially distinct packaging, initialization, or shutdown risks.

## Kitchen-sink role

The Playground kitchen sink is one broad compatibility canary, not the primary experiment-worker fixture.

Use it to prove:

- A large realistic Mastra project can build an experiment artifact.
- Unselected registered integrations do not break import or construction.
- One selected agent and workflow run from a complex dependency graph.
- Broad initialization still permits orderly shutdown.

Do not make core experiment-worker acceptance depend on launching Studio, Playwright, or Chromium. Focused fixtures remain authoritative for package managers, workspace precedence, sandbox cancellation, persistence, and portability.

## Automation model

Automate almost everything, including scenarios outside normal CI.

“Manual” or “outside normal CI” should normally mean invoking a deterministic repository-owned command, not manually creating projects or typing protocol frames.

The harness should automate:

- Fixture materialization and copying.
- npm, pnpm, and Yarn installation.
- Verdaccio registry startup or CI registry consumption.
- CLI and artifact build.
- Manifest validation.
- Artifact relocation.
- Protocol request generation from the artifact manifest.
- Fresh worker launch.
- NDJSON parsing and transcript assertions.
- Exit code and event ordering assertions.
- LibSQL/Postgres persistence queries.
- Docker service lifecycle.
- Process and handle leak detection.
- Repeated builds and manifest comparison.
- Concurrent workers.
- Diagnostics and artifact retention on failure.
- JSON and Markdown matrix reports.
- Clear gated-skip reasons.

Desired commands, with exact names finalized during implementation:

```bash
pnpm experiment:e2e --tier pr
pnpm experiment:e2e --tier full
pnpm experiment:e2e --scenario kitchen-sink
pnpm experiment:e2e --scenario postgres
pnpm experiment:e2e --scenario remote-sandbox
```

Vitest tests and standalone matrix commands should share the same Node harness and declarative scenario definitions.

## Suggested suite structure

The goal plan may refine filenames after inspecting existing E2E conventions, but should preserve this separation:

```text
e2e-tests/experiment-worker/
├── package.json
├── pnpm-workspace.yaml
├── vitest.config.ts
├── setup.ts
├── helpers/
│   ├── materialize-project.ts
│   ├── install-project.ts
│   ├── build-worker.ts
│   ├── inspect-manifest.ts
│   ├── copy-artifact.ts
│   ├── run-protocol.ts
│   ├── assert-persistence.ts
│   └── process-cleanup.ts
├── scenarios/
│   ├── definitions.ts
│   └── runner.ts
├── tests/
│   ├── pr-matrix.test.ts
│   ├── full-matrix.test.ts
│   └── native-and-package-managers.test.ts
└── fixtures/
    ├── pnpm-runtime-matrix/
    ├── pnpm-native-duckdb/
    ├── pnpm-monorepo/
    ├── npm-minimal/
    └── yarn-minimal/
```

Follow existing `e2e-tests/deployers` registry setup conventions:

- Use CI-provided registry/tag context when available.
- Fall back to suite-local publication for direct local execution.
- Inject registry and tag values into Vitest context.
- Publish only the package roots required by the suite.

## CI tiers

### Tier 1 — normal pull-request CI

Target 6–8 deterministic, credential-free scenarios and a runtime under approximately five minutes after the shared registry is available:

1. Minimal agent build and fresh-process run.
2. Agent with strict tool mocks and deny-unmocked policy.
3. Workflow including resume-shaped behavior.
4. Local workspace with filesystem and a real skill.
5. Local sandbox cancellation and process cleanup.
6. Stateful LibSQL/vector agent with no experiment/score persistence.
7. Strict-pnpm native artifact, preferably DuckDB.
8. Copied-artifact execution.

The final subset may combine assertions where attribution remains clear, but must not remove the native, persistence, copied-artifact, workspace, or sandbox gates.

### Tier 2 — required full matrix

Fully automated and runnable locally, on demand, and in scheduled CI. Target under 15 minutes from a built workspace where feasible; a 15–30 minute ceiling is acceptable if installs and service-backed cases require it.

Include:

- All required npm, pnpm, and Yarn project shapes.
- pnpm monorepo and local workspace packages.
- Broader workspace ownership, dynamic workspace, and concurrency cases.
- Postgres.
- LSP and browser lifecycle.
- Mounts, search, and vector workspace behavior.
- Multiple concurrent workers sharing an artifact.
- Repeated-build manifest reproducibility.
- Success/failure/cancellation fresh-process sequences.
- Kitchen-sink canary.
- Extended spawned-artifact protocol and shutdown cases.

There is no existing universal nightly E2E framework to assume. The goal plan must explicitly add scheduled and/or manual-dispatch wiring if Tier 2 is placed in a new workflow rather than the existing E2E workflow.

### Tier 3 — credential-gated automation

Automated but skipped with a machine-readable reason when credentials or infrastructure are unavailable:

- Remote sandbox.
- Object-store filesystem.
- Real model provider.
- Hosted/platform proxy provider.
- Platform Linux sandbox execution.

Credential-gated tests must not block required OSS PR acceptance.

## Platform ownership boundary

Keep these outside required OSS acceptance:

- Platform ZIP admission and outer attestation.
- Platform persistence and retry orchestration.
- Vendor-by-vendor hosted sandbox coverage.
- Cross-platform native binaries that cannot execute on the CI host.
- Real Platform Linux sandbox installation and worker orchestration owned by MASTRA-4503/MASTRA-4498.

The OSS suite should prove artifact compatibility and expose reusable scenario expectations. A Platform runner may consume those expectations in its Linux sandbox, but Platform credentials and staging infrastructure are not prerequisites for the OSS PR gate.

## Negative project shapes

The goal must include deterministic expected failures with actionable diagnostics:

- Unsafe output directory.
- Malformed pnpm build approvals.
- Unsupported native dependency without externalization.
- Missing customer `#mastra` entry.
- Import or constructor failure before run acceptance.
- Missing or invalid target/scorer IDs.
- Workspace configuration conflicts such as filesystem plus mounts.
- Vector search without the required embedder/vector configuration.
- Workspace, sandbox, or shutdown initialization failure.

Do not duplicate package-local unit cases unless a complete installed artifact changes the behavior under test.

## Artifact and report requirements

Each scenario should record enough evidence for CI and local diagnosis:

- Fixture and package manager.
- Installed Mastra package versions/tag.
- Build command and exit result.
- Artifact manifest summary and content digest.
- Whether the artifact was relocated.
- Protocol request and complete stdout transcript.
- Stderr diagnostics.
- Terminal event and process exit code.
- Database persistence assertions where applicable.
- Cleanup and process-leak assertions.
- Skip reason for gated scenarios.

Produce machine-readable JSON plus a concise Markdown summary. Preserve failing fixture directories or copy diagnostics into CI artifacts where existing E2E conventions permit it.

## Artifact portability requirements

For baseline, strict-pnpm/native, stateful database, and workspace/sandbox shapes:

1. Build the artifact.
2. Inspect its manifest and declared dependencies.
3. Copy it to a new absolute path.
4. Prevent source-workspace fallback resolution.
5. Launch it with a production-like environment.
6. Execute a protocol request.
7. Verify output, natural exit, and cleanup.

Repeated-build coverage must normalize or exclude intentionally unique fields before comparing reproducible manifest content.

## CI integration direction

Add an experiment-worker job to `.github/workflows/e2e-tests.yml` or a dedicated reusable/scheduled workflow that consumes the shared Verdaccio registry artifact.

Update affected-test routing in `.github/workflows/prebuild.yml` using existing package-impact mechanisms where possible. Explicit direct triggers should include:

- `packages/cli/src/commands/experiment/**`
- Relevant deployer bundling, analysis, and dependency-install paths
- `e2e-tests/experiment-worker/**`
- Experiment E2E workflow files
- Package manifests and `pnpm-lock.yaml`

Avoid an unnecessarily broad hand-written Core path list when existing affected-package routing can determine dependency impact.

## Existing tests versus new E2E ownership

### Keep package-local

- UTF-8 and NDJSON parsing.
- Frame sizes and terminal newline rules.
- Sequencing and correlation.
- Timer and deadline mechanics.
- Heartbeat coalescing and output backpressure internals.
- Terminal/exit-code semantic invariants.
- Manifest traversal and digest unit cases.
- Deployer dependency-analysis and approval-validation units.

### Add to external E2E

- Published-package installation.
- Complete customer project construction.
- Real `mastra experiment build` invocation.
- Dependency installation in the generated artifact.
- Customer bundler configuration propagation.
- Native external declaration without local binary evaluation.
- Fresh standalone process execution.
- Copied-artifact portability.
- Customer storage behavior and persistence isolation.
- Workspace/sandbox lifecycle and leak assertions.
- Package-manager and monorepo compatibility.

## Required proof strategy for the eventual goal plan

The goal-ready plan should use the E2E harness itself as live proof.

Expected proof artifacts under the eventual plan's `.proof/` directory:

- A one-command PR-tier run transcript.
- A machine-readable matrix report.
- At least one representative protocol transcript.
- A copied-artifact run transcript.
- A persistence query/result proving customer state exists while experiment/score state does not.
- A native strict-pnpm artifact result.
- For any bug fixed while building the harness, red-on-base and green-on-branch transcripts when reproducible.

A browser recording is unnecessary unless the goal later adds Studio-facing behavior. The worker is headless.

## Runtime and maintenance budget

Set and enforce practical ceilings:

- Tier 1: approximately five minutes after registry publication.
- Tier 2: target under 15 minutes from a built workspace; allow up to 30 minutes only with explicit service/install justification.
- Tier 3: independent jobs with explicit timeouts.
- Pin third-party fixture dependencies to known versions.
- Cache or memoize installs/builds only when isolation guarantees remain intact.
- Always clean temporary directories, process groups, databases, containers, ports, and locks.
- On failure, retain enough diagnostics to reproduce without rerunning the entire matrix.

## Manual testing boundary

Manual work should be limited to:

- Initial exploratory debugging of an unknown provider or project shape.
- Initial credential setup.
- Platform staging confirmation where Platform infrastructure is required.
- Occasional customer-project dogfooding.

The August 4 DuckDB smoke project remains a useful external proof case. Any discovered behavior that represents a supported contract should be converted into a repository-owned automated scenario.

## Goal-plan drafting requirements

The next planning agent should convert this handoff into a goal-ready plan, not begin implementation directly.

The goal plan must:

- Use phased, coherent commits with a goal-judge stop after every phase.
- Start with environment setup and baseline verification.
- Create `.mastracode/plans/<name>.progress.md` in Phase 0 and declare `.mastracode/plans/<name>.amendments.md` in the iteration protocol.
- Name concrete implementation and test files after inspecting current E2E conventions.
- Prove every verification command shape before putting it in the plan.
- Include focused verification per phase rather than batching all tests at the end.
- Include a changeset/docs decision with evidence.
- Include the approved live-proof method above.
- Include a cold adversarial review prompt and final human approval gate.
- Keep plan, progress, amendments, and proof session artifacts uncommitted.

A likely phase decomposition is:

1. Baseline and E2E registry/harness skeleton.
2. Artifact build/run protocol helpers and diagnostics.
3. Core deterministic PR scenarios.
4. Workspace, sandbox, stateful storage, and cleanup scenarios.
5. Package-manager, monorepo, native, portability, and reproducibility scenarios.
6. Full-matrix runner, reporting, and CI tier wiring.
7. Credential-gated scenario interfaces and documented skips, without requiring credentials for completion.
8. Ship checks, proof artifacts, changesets/docs, adversarial review, and human handoff.

The drafting agent may adjust phase count to preserve coherent reviewable commits, but should not collapse the harness, core acceptance, full matrix, and CI integration into one unreviewable phase.

## Decisions already made

Do not reopen these during goal-plan drafting unless repository facts make them impossible:

- The durable result is committed automated E2E infrastructure, not a collection of manual smoke projects.
- The suite belongs under `e2e-tests/experiment-worker` unless a more specific existing convention is discovered during final drafting.
- Verdaccio-installed packaged artifacts are the authoritative E2E mode.
- Runtime-only pnpm variations may share a fixture; installation-sensitive shapes use separate roots.
- npm, strict pnpm, pnpm monorepo, and Yarn Berry with `node_modules` linker are required in the full matrix.
- Workspaces and sandboxes are the highest-priority behavioral dimensions.
- LibSQL, DuckDB/native packaging, and one real vector adapter are required locally; Postgres is required in the automated full matrix.
- The kitchen sink is a canary, not the primary acceptance fixture.
- Most non-PR scenarios remain automated and runnable on demand.
- Remote sandbox and real model runs are optional and credential-gated.
- Platform Linux sandbox execution is outside required OSS acceptance.
- Package-local tests retain ownership of exhaustive protocol mechanics.
- True Yarn PnP, Bun, every database adapter, and every hosted provider are outside the initial goal.

## Goal-ready outcome statement

Use this as the starting goal statement:

> Add an independent `e2e-tests/experiment-worker` suite that consumes Mastra packages from the repository's shared published Verdaccio registry, installs representative customer projects in isolated package-manager roots, builds standalone experiment-worker artifacts, validates and relocates them, and executes each through fresh child processes. Provide a deterministic 6–8-scenario PR gate, a larger fully automated on-demand/scheduled matrix covering required package managers, workspace/sandbox lifecycle, persistence, databases, native dependencies, monorepos, portability, and process isolation, plus credential-gated provider scenarios that do not block OSS acceptance. Keep exhaustive protocol mechanics package-local, Playground as a compatibility canary, and Platform Linux sandbox execution outside the required OSS gate.
