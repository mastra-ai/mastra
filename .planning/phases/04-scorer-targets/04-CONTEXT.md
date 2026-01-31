# Phase 4: Scorer Targets - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Run datasets against scorers to calibrate/align LLM-as-judge evaluation. Test if a scorer's scores match human-labeled ground truth. Processor targets dropped from scope — not a core use case.

</domain>

<decisions>
## Implementation Decisions

### Scorer input contract

- `item.input` contains exactly what the scorer expects (user structures it)
- Scorer receives: `scorer.run(item.input)` — direct passthrough, no field mapping
- `item.expectedOutput` holds human label for alignment comparison (Phase 5 analytics)
- No new fields on DatasetItem — matches agent/workflow pattern

### Score comparison

- Don't auto-compare scorer output to expectedOutput
- Store both values — let user analyze alignment in analytics phase
- No tolerance/threshold matching — just data collection

### Result structure

- Same structure as agent/workflow runs: output, latency, error
- Scorer's score/reason goes in output field
- Consistent ItemResult shape across all target types

### Meta-scoring

- Allow optional scorers[] when running scorer-as-target
- Can score the scorer's output (e.g., consistency, confidence calibration)
- Same scoring mechanics as agent/workflow runs

### Error handling

- Invalid score (NaN, wrong type): Store null + warning, continue run
- Scorer throws: Catch and store error message, continue run
- Match existing `runScorersForItem` isolation pattern

</decisions>

<specifics>
## Specific Ideas

- LLM-as-judge calibration workflow: run dataset with human-labeled scores, compare scorer alignment
- Referenced Ragas alignment methodology: dataset row = (question, response, grading_notes, target)
- Pattern: iterate on scorer prompt until alignment % meets threshold

</specifics>

<deferred>
## Deferred Ideas

- Processor targets — dropped from roadmap entirely (complex stream-based, multi-phase, not core use case)

</deferred>

---

_Phase: 04-scorer-targets_
_Context gathered: 2026-01-24_
