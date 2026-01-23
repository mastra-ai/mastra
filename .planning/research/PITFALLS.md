# Pitfalls: AI Evaluation Datasets

**Research Date:** 2026-01-23
**Domain:** Evaluation dataset features for AI frameworks (Langfuse, Braintrust, LangSmith patterns)

---

## 1. Dataset Staleness and Version Drift

**What Goes Wrong:**
Users modify prompts/models but forget to update test cases. Dataset becomes out of sync with actual system behavior. Cross-version comparisons produce misleading results because test cases don't reflect same edge cases.

**Warning Signs:**
- Scores improving while user complaints increase
- Test cases with outdated expected output formats
- Large gaps between dataset version timestamps and code changes
- Cross-version comparisons showing "improvements" on removed functionality

**Prevention Strategy:**
- Auto-version datasets on ANY item change (not just explicit version bump)
- Surface version metadata prominently: item count, last modified, schema changes
- Warn loudly when comparing runs across versions with different item counts
- Track dataset lineage: which version was active when a given run was executed

**Phase to Address:** Schema Design + UI/Run Comparison

---

## 2. Non-Deterministic Scoring Without Aggregation Context

**What Goes Wrong:**
LLM-based scorers return different scores on same input across runs. Users see score variance and lose confidence in evaluation system. Single-run comparisons become meaningless noise.

**Warning Signs:**
- Same test case producing score swings > 10% between runs
- Users re-running identical evals "to get a better score"
- Debates about whether a 0.02 score change is "real"
- Flaky CI failures from score threshold violations

**Prevention Strategy:**
- Display confidence intervals, not just raw scores
- Require multiple scorer runs per item (minimum 3) for LLM-based scorers
- Show score distribution histograms, not single values
- Provide scorer type metadata: deterministic vs stochastic
- Consider median over mean for aggregations

**Phase to Address:** Run Execution + Results Display

---

## 3. Missing Input/Output Preservation

**What Goes Wrong:**
Runs store only scores, not the actual inputs/outputs that produced them. Users can't debug why a score dropped. Can't replay failed cases. Audit trail is incomplete.

**Warning Signs:**
- Users asking "what did the agent actually say for this test case?"
- No way to reproduce a specific failing run
- Score regressions with no explanation pathway
- Compliance/audit requests that can't be answered

**Prevention Strategy:**
- Store full input/output for EVERY run result (not just scores)
- Implement storage size limits with clear warning, not silent truncation
- Provide "replay" functionality: re-run single item with same context
- Link results to traces when available (existing observability integration)

**Phase to Address:** Storage Schema + Run Execution

---

## 4. Scorer-Target Type Mismatch

**What Goes Wrong:**
Scorers designed for agents applied to workflows (or vice versa). Type system doesn't catch it at compile time. Runtime errors or garbage scores result.

**Warning Signs:**
- Scorers receiving `undefined` for expected input fields
- TypeScript `any` leaking through scorer interfaces
- Different scorers producing wildly different results on same target
- Frequent "scorer not compatible with target" support questions

**Prevention Strategy:**
- Leverage existing `type: 'agent'` on MastraScorer for explicit type narrowing
- Validate scorer/target compatibility at run creation time (not execution)
- Surface incompatibility as user-facing error with clear remediation
- Provide distinct scorer registries per target type in UI

**Phase to Address:** Schema Design + Run Triggering

---

## 5. CI Integration Without Failure Semantics

**What Goes Wrong:**
Eval runs in CI without clear pass/fail criteria. Teams don't know what score threshold matters. CI either never fails (useless) or fails randomly (ignored). No connection between CI failure and actionable fix.

**Warning Signs:**
- CI eval jobs that have never failed
- CI eval jobs that are permanently red and ignored
- No documented threshold for "acceptable" scores
- Score regressions discovered in production, not CI

**Prevention Strategy:**
- Require explicit threshold configuration per scorer when used in CI
- Provide baseline comparison mode: fail if worse than previous run
- Output machine-readable results (JSON) with clear pass/fail field
- Include specific failing test cases in CI output (not just aggregate)
- Support "warning" vs "failure" threshold levels

**Phase to Address:** CI Integration + CLI Design

---

## 6. Comparison Without Controlling for Variables

**What Goes Wrong:**
Users compare runs with different models, different prompts, AND different datasets. Conclude "new model is better" when actually dataset changed. Confounding variables make conclusions invalid.

**Warning Signs:**
- Run metadata doesn't capture model/prompt versions
- Comparisons mixing dataset versions without warning
- No "diff" view showing what changed between compared runs
- Users drawing wrong conclusions from comparisons

**Prevention Strategy:**
- Capture target configuration snapshot in run metadata (model, prompt hash)
- Block comparison or show prominent warning when dataset versions differ
- Provide "what changed" summary between any two runs
- Allow filtering comparison to "same dataset version only"

**Phase to Address:** Run Metadata + Comparison UI

---

## 7. Overwhelming Initial Setup Friction

**What Goes Wrong:**
Users must configure storage, create dataset, add items, pick scorers, configure target before seeing ANY value. Abandonment before first successful run. "Too complicated" feedback.

**Warning Signs:**
- High bounce rate from datasets page
- Users creating empty datasets that never get items
- Frequent "how do I just try this" questions
- Long time-to-first-run metrics

**Prevention Strategy:**
- Provide "quick run" path: paste input, pick target, go
- Include sample datasets with one click import
- Allow dataset creation from existing trace data (leverage observability)
- Progressive disclosure: basic mode vs advanced configuration
- Show value immediately: run single item inline before full dataset setup

**Phase to Address:** UI Design (especially onboarding flow)

---

## 8. Human Evaluation Workflow Abandonment

**What Goes Wrong:**
Human eval feature added but workflow is clunky. Reviewers start but don't finish. Partial human labels worse than none. No tracking of reviewer progress or inter-rater reliability.

**Warning Signs:**
- Human eval runs with < 50% items reviewed
- No reviewer assignment or tracking
- Disagreement between reviewers not surfaced
- Human scores never actually used in comparisons

**Prevention Strategy:**
- Design complete workflow: assign, review, complete, aggregate
- Track progress: "X of Y items reviewed by Z reviewer"
- Surface inter-rater reliability when multiple reviewers
- Allow partial completion with clear "incomplete" status
- Integrate with existing flow: run without scorers = human eval mode

**Phase to Address:** Human Evaluation Feature Design

---

## 9. Ignoring Cost and Latency in Eval Runs

**What Goes Wrong:**
Eval run triggers 1000 LLM calls. User gets surprise $50 bill. Or run takes 2 hours and times out. No visibility into resource consumption until it's too late.

**Warning Signs:**
- Eval runs that never complete
- Users avoiding evals due to cost concerns
- No cost estimation before run
- Production incidents from eval overloading shared infrastructure

**Prevention Strategy:**
- Estimate and display cost before run starts (token count x pricing)
- Show progress: items completed, estimated time remaining
- Implement rate limiting and concurrency controls (existing concurrency param)
- Allow "sample N items" for quick iteration before full run
- Separate eval infrastructure from production (different API keys, rate limits)

**Phase to Address:** Run Triggering UI + Execution Engine

---

## 10. Bulk Import Without Validation

**What Goes Wrong:**
CSV import with 10k rows. 500 rows have malformed data. Import either fails completely or silently creates broken items. User discovers problem during run execution.

**Warning Signs:**
- Import "succeeds" but items are malformed
- Run failures due to bad test case data
- No preview before import commit
- Users re-importing same CSV multiple times

**Prevention Strategy:**
- Validate ALL rows before importing ANY (fail fast)
- Show preview: first 10 rows, detected columns, validation issues
- Provide row-level error reporting: "Row 523: missing 'input' field"
- Support dry-run mode: validate without committing
- Allow partial import with explicit "skip invalid rows" option

**Phase to Address:** Bulk Import Feature

---

## 11. No Baseline Concept

**What Goes Wrong:**
Users run evals but have no "known good" reference point. Can't answer "is 0.85 good or bad?" Every comparison is relative to arbitrary previous run. Regressions slip through because threshold is wherever last run landed.

**Warning Signs:**
- Thresholds that drift over time
- "What should our target score be?" questions
- No distinction between "baseline" and "latest" runs
- Regressions masked by gradual score decline

**Prevention Strategy:**
- First-class "baseline" concept: pin a run as the reference
- Compare all subsequent runs to baseline by default
- Alert when scores drop below baseline
- Allow updating baseline with explicit action and reason
- Track baseline history: when changed, by whom, why

**Phase to Address:** Schema Design + Comparison Feature

---

## 12. Tight Coupling to Specific Target Implementation

**What Goes Wrong:**
Dataset system only works with Mastra agents. Users want to eval external APIs, third-party models, custom functions. Feature becomes too narrow to be useful. Users build workarounds.

**Warning Signs:**
- Requests to eval "raw API" without Mastra wrapper
- Users wrapping external services in dummy agents
- Feature used only for Mastra-native targets
- Competitor tools winning because they're target-agnostic

**Prevention Strategy:**
- Design target interface as protocol, not concrete type
- Support "callable" target: any async function with input/output
- Separate "run against target" from "run with stored output"
- Allow importing existing outputs for scoring (eval-only mode)

**Phase to Address:** Schema Design + Target Interface

---

## Summary Table

| Pitfall | Severity | Detection Difficulty | Phase |
|---------|----------|---------------------|-------|
| Dataset Staleness | High | Medium | Schema + UI |
| Non-Deterministic Scoring | High | Low | Run + Results |
| Missing I/O Preservation | Critical | Low | Storage |
| Scorer-Target Mismatch | Medium | Low | Schema + Run |
| CI Without Failure Semantics | High | Medium | CI + CLI |
| Uncontrolled Comparisons | High | High | Metadata + Comparison |
| Setup Friction | Medium | Low | UI Onboarding |
| Human Eval Abandonment | Medium | Medium | Human Eval Design |
| Cost/Latency Ignorance | High | Low | Run UI + Execution |
| Bulk Import Validation | Medium | Low | Import Feature |
| No Baseline Concept | High | Medium | Schema + Comparison |
| Tight Target Coupling | High | High | Schema + Interface |

---

*Analysis based on: Langfuse, Braintrust, LangSmith user patterns, existing Mastra evals architecture, common evaluation system anti-patterns.*
