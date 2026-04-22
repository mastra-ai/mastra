# MastraCode Evals — Implementation Progress

> Last updated: 2026-04-22
> Branch: `feat/mastracode/evals`

---

## Overview

MastraCode evals provide two scoring layers:

1. **Live Scorers** — Run during normal MastraCode sessions, scoring tool output in real-time
2. **Offline Experiments** — Run sessions in sandboxed workspaces against datasets with ground truth

Both layers share core infrastructure in `@mastra/core/evals` and `@mastra/core/datasets/experiment/sandbox`.

---

## Architecture

### Live Scoring Pipeline

```
Agent.generate() → #runScorers() [fire-and-forget]
  → prepareRun() [scorer-specific filtering via filterRun()]
  → scorer.run() [async, non-blocking]
  → score saved to DuckDB via observability exporter
```

### Offline Experiment Pipeline

```
/experiment seed → seedFromTraces() → DuckDB traces → dataset items
/experiment run  → runSandboxExperiment()
  → lifecycle.setup()    → materialize workspace, init harness, seed memory
  → lifecycle.execute()  → send user message, collect tool calls + messages
  → lifecycle.teardown() → destroy harness + workspace
  → run offline scorers (outcome-match, trajectory-efficiency, llm-judge)
/experiment results → list experiment scores
```

---

## Components

### Live Scorers (`mastracode/src/evals/scorers/`)

| Scorer | Sampling | Description |
|--------|----------|-------------|
| **Outcome** (`outcome.ts`) | 100% | Build/test pass, tool errors, stuck loops, regression, autonomy |
| **Efficiency** (`efficiency.ts`) | 30% | Redundancy, turn count, retry patterns, read-before-edit |

Shared utilities:
- `extract-tools.ts` — Extract tool invocations from MastraDBMessages (handles both parts and legacy formats)
- `classify-command.ts` — Shared build/test command classification, exit code parsing, path matching

### Offline Scorers (`mastracode/src/evals/scorers/offline/`)

| Scorer | Description |
|--------|-------------|
| **Outcome Match** (`outcome-match.ts`) | Compare output against ground truth assertions |
| **Trajectory Efficiency** (`trajectory-efficiency.ts`) | Score against expected tool/step/latency bounds |
| **LLM Judge** (`llm-judge.ts`) | LLM-based correctness and methodology evaluation |

### Experiment Infrastructure (`mastracode/src/evals/experiments/`)

| File | Purpose |
|------|---------|
| `lifecycle.ts` | MastraCode-specific sandbox setup/execute/teardown lifecycle |
| `trace-to-item.ts` | Convert DuckDB traces into experiment dataset items |
| `seed-dataset.ts` | Seed datasets from trace history with feedback filtering |
| `types.ts` | Type definitions for MastraCode experiment items and ground truth |

### Core Infrastructure (`packages/core/`)

| File | Purpose |
|------|---------|
| `src/evals/base.ts` | `createScorer`, `filterRun`, `prepareRun` |
| `src/datasets/experiment/sandbox/` | `runSandboxExperiment` with workspace isolation |

### TUI Commands (`mastracode/src/tui/commands/`)

| Command | Description |
|---------|-------------|
| `/experiment` | Seed datasets, run experiments, view results |
| `/feedback` | Record feedback (thumbs, rating, comment) on current trace |

---

## Test Coverage

| Test File | Tests | Description |
|-----------|-------|-------------|
| `scorers/__tests__/outcome.test.ts` | 24 | Live outcome scorer dimensions |
| `scorers/__tests__/efficiency.test.ts` | 16 | Live efficiency scorer dimensions |
| `scorers/__tests__/classify-command.test.ts` | 18 | Shared command classification |
| `scorers/offline/__tests__/outcome-match.test.ts` | 4 | Offline ground truth matching |
| `scorers/offline/__tests__/trajectory-efficiency.test.ts` | 2 | Offline efficiency bounds |
| `experiments/__tests__/trace-to-item.test.ts` | 17 | Trace-to-dataset-item conversion |
| `experiments/__tests__/seed-dataset.test.ts` | 10 | Dataset seeding from traces |
| `packages/core/.../prepareRun.test.ts` | ~50 | Core prepareRun/filterRun infrastructure |
| `packages/core/.../sandbox/*.test.ts` | 5 | Core sandbox runner |

---

## Known Limitations / Future Work

- **Task completion**: No way to measure whether the user's original intent was fulfilled (would need post-session feedback or task-level ground truth).
- **Task-complexity normalization**: Turn count scoring doesn't adjust for task complexity.
- **Lifecycle tests**: `lifecycle.ts` is tightly coupled to Harness/MastraCode internals; full integration tests would require the full Harness stack.
- **Shared command classification**: Build/test detection covers common patterns but may miss unusual setups.
- **Custom assertions**: `file-contains` and `file-exists` assertions infer from tool call history, not actual filesystem state.
