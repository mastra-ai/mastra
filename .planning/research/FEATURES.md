# AI Evaluation Datasets — Feature Research

Research on: Langfuse, Braintrust, LangSmith datasets features.
Goal: Identify table stakes vs differentiators for Mastra datasets.

---

## Table Stakes (Must Have)

Features users expect from any evaluation dataset platform. Missing = users leave.

### Dataset Management

| Feature | Complexity | Notes |
|---------|------------|-------|
| Create/edit/delete datasets | Low | Basic CRUD |
| Dataset naming + description | Low | Metadata for organization |
| List datasets with pagination | Low | Standard UI pattern |
| Dataset items with input/expected output | Low | Core data model |
| Free-form metadata on items | Medium | JSON blob for context, tags |
| Bulk import (CSV, JSON) | Medium | Critical for adoption — nobody types 100 cases |
| Bulk export | Low | Data portability |
| Duplicate dataset | Low | Fork for experiments |

### Test Case Structure

| Feature | Complexity | Notes |
|---------|------------|-------|
| Input field (any JSON) | Low | Required |
| Expected output (optional) | Low | For comparison scoring |
| Metadata/context field | Low | Arbitrary JSON for scorer context |
| Unique ID per item | Low | For tracking across versions |

### Running Evaluations

| Feature | Complexity | Notes |
|---------|------------|-------|
| Run dataset against target | Medium | Core feature — agent/workflow/function |
| Select which scorers to apply | Medium | Decouple scoring from target |
| View run progress (streaming) | Medium | UX critical — don't make users wait blind |
| Run history with timestamps | Low | Basic auditing |
| Per-item results in run | Low | Input → output → scores |
| Pass/fail status per item | Low | Derived from scores |
| Aggregate scores per run | Low | Summary statistics |

### Comparison

| Feature | Complexity | Notes |
|---------|------------|-------|
| Compare two runs side-by-side | Medium | Core regression detection |
| Show score deltas | Low | +/- from baseline |
| Highlight regressions (red) | Low | Visual signal |
| Filter to changed/failed items | Low | Focus on problems |

### API Access

| Feature | Complexity | Notes |
|---------|------------|-------|
| SDK for CRUD operations | Medium | TypeScript SDK |
| SDK for running evaluations | Medium | CI integration |
| Programmatic results access | Low | Export run results |

---

## Differentiators (Competitive Advantage)

Features that create switching cost or unique value.

### Versioning & History

| Feature | Complexity | Dependencies | Notes |
|---------|------------|--------------|-------|
| Auto-versioning on item changes | Medium | Storage schema | Langfuse: explicit versions. Braintrust: auto-versions. Auto is better UX |
| Version comparison (diff view) | High | Versioning | See what changed between versions |
| Rollback to previous version | Medium | Versioning | Undo mistakes |
| Cross-version run comparison | High | Versioning, Comparison | Compare runs on v1 vs v2 with clear warning about dataset changes |

### Advanced Evaluation

| Feature | Complexity | Dependencies | Notes |
|---------|------------|--------------|-------|
| Human evaluation workflow | High | Run results, UI | Braintrust does this well — annotate outputs without automated scores |
| Multi-scorer composition | Medium | Scorer system | Apply multiple scorers, weighted aggregate |
| Custom scorer per item | High | Item metadata | Override default scorer for edge cases |
| Baseline run for comparison | Medium | Run history | Pin a run as "baseline" for future comparisons |
| Statistical significance on deltas | High | Math, enough samples | Avoid false alarms on noise |

### Tracing Integration

| Feature | Complexity | Dependencies | Notes |
|---------|------------|--------------|-------|
| Link runs to traces | Medium | Tracing system | Langfuse strength — see full trace for each item |
| Create dataset items from traces | Medium | Tracing system | Production → test case pipeline |
| Trace-based filtering for items | High | Tracing, Search | Find traces matching criteria, add to dataset |

### Collaboration

| Feature | Complexity | Dependencies | Notes |
|---------|------------|--------------|-------|
| Comments on dataset items | Medium | Storage, UI | Team discussion |
| Annotations on run results | Medium | Storage, UI | Human labels on outputs |
| Shared datasets across projects | Medium | Multi-tenancy | Reuse golden sets |

### CI/CD Integration

| Feature | Complexity | Dependencies | Notes |
|---------|------------|--------------|-------|
| GitHub Action | Medium | API | Run evals on PR |
| Fail CI on regression threshold | Low | API | Gate deployments |
| PR comment with results | Medium | GitHub API | Inline feedback |
| Scheduled evaluation runs | Medium | Cron, API | Nightly regression checks |

### UX Polish

| Feature | Complexity | Dependencies | Notes |
|---------|------------|--------------|-------|
| Keyboard shortcuts | Low | UI | Power users |
| Search/filter within dataset | Medium | UI, possibly index | Find specific cases |
| Drag-drop item reordering | Low | UI | Manual organization |
| Rich text in expected output | Medium | UI, Storage | Beyond plain text |
| Inline editing of items | Low | UI | No modal required |

---

## Anti-Features (Deliberately NOT Building)

Features that add complexity without proportional value for Mastra's use case.

| Feature | Reason to Avoid |
|---------|----------------|
| Real-time collaboration (multiplayer) | Massive complexity, low ROI for v1 — team of 1-3 doesn't need it |
| Dataset marketplace/sharing | Focus on single-team use first — distribution is a different product |
| Auto-generated test cases from production | Requires production tracing + curation flow — future enhancement |
| LLM-as-judge built into datasets | Keep scorers separate — evals package already handles this |
| Custom dashboards/charts | Use existing analytics tools — not our core value |
| Fine-tuning integration | Different product — datasets for eval, not training |
| A/B testing framework | Overlaps but distinct — eval is offline, A/B is online |
| Dataset templates library | Premature — don't know what templates are useful yet |
| Automatic scorer suggestion | AI magic that often disappoints — explicit is better |

---

## Feature Dependencies

```
Dataset Management (foundation)
    │
    ├── Test Case Structure
    │       │
    │       └── Running Evaluations
    │               │
    │               ├── Comparison
    │               │       │
    │               │       └── Cross-version comparison (requires Versioning)
    │               │
    │               └── Human Evaluation Workflow
    │
    └── Versioning
            │
            ├── Version Comparison
            │
            └── Rollback

API Access ─── CI/CD Integration

Tracing Integration (independent, requires external tracing)
```

---

## Competitive Matrix

| Feature | Langfuse | Braintrust | LangSmith | Mastra v1 Target |
|---------|----------|------------|-----------|------------------|
| Dataset CRUD | Yes | Yes | Yes | Yes |
| Bulk import | Yes | Yes | Yes | Yes |
| Versioning | Explicit | Auto | Manual | Auto |
| Run against targets | Yes | Yes | Yes | Yes |
| Multiple scorers | Yes | Yes | Yes | Yes |
| Human eval workflow | Partial | Strong | Yes | v1.1 |
| Run comparison | Yes | Yes | Yes | Yes |
| Trace integration | Strong | Partial | Strong | Future |
| CI integration | Yes | Yes | Yes | Yes |
| Statistical significance | No | Yes | No | Future |
| Cross-version comparison | No | Partial | No | Yes (with warnings) |

---

## Recommendations for Mastra v1

### Must Ship

1. Dataset CRUD with metadata
2. Items with input/expected/context fields
3. Bulk CSV import
4. Run dataset against agent/workflow
5. Select scorers per run
6. Results view with pass/fail
7. Compare two runs
8. SDK for CI usage

### Should Ship (if time permits)

1. Auto-versioning on changes
2. Baseline run pinning
3. Basic search/filter
4. Export results

### Defer to v1.1

1. Human evaluation workflow
2. Trace integration
3. Version diff view
4. GitHub Action
5. Annotations/comments

---

*Research based on: Langfuse docs, Braintrust docs, LangSmith docs, competitor analysis*
*Last updated: 2026-01-23*
