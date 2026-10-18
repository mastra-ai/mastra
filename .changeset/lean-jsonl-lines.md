---
'@mastra/code-sdk': patch
---

Fixed headless `--output jsonl` runs writing gigabytes of repeated data. The stream included a `display_state_changed` event after almost every other event, and each one carried a full copy of the session's display state, including every large tool result and all shell output so far. Long runs could fill the disk.

`--output jsonl` no longer writes `display_state_changed` events. Every other event, and the final `result` line, is written as before. The omitted snapshots only repeated what the other events already carry. Consumers that rebuilt UI state from these snapshots should fold the remaining events instead. `--output json`, `--output human`, and programmatic `runMC()` iteration are unchanged.
