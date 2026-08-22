---
'@mastra/memory': patch
---

Let a simulation arm hand curation entirely to the system under test with `--cadence off`.

The replay driver curates on its own schedule, which is right for comparing capture prompts
but makes a run useless as evidence about when Memory itself decides to curate — the driver's
calls are indistinguishable from the ones being measured. `--cadence off` (or `curationCadence:
false`) stops both the scheduled curation and the tail flush, so every curation in the result is
one the library chose to run.
