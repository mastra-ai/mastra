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
- Dataset item provides: input, output (thing being judged), expectedOutput (human label)
- Scorer receives: `scorer.run({ input: item.input, output: item.output, groundTruth: item.expectedOutput })`
- Claude decides: Whether to add explicit `item.output` field or nest scorer data in `item.input`
- Follow pattern that aligns with existing Mastra conventions

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

### Claude's Discretion
- Input schema design (nested vs flat fields)
- Adapter normalization logic
- Validation rules for scorer input

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

*Phase: 04-scorer-targets*
*Context gathered: 2026-01-24*
