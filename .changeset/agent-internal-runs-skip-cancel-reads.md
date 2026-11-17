---
'@mastra/core': patch
---

Agents with input or output processors make fewer storage reads per call.

Each `generate()` or `stream()` call runs short internal workflows to prepare the call and to run processors. These workflows are never stored, but they still read a cancellation status from storage before and between their steps. Those reads always came back empty. With two input processors and one output processor on PostgreSQL, a call made 25 status reads, and 14 of them were these empty reads. These workflows no longer read the status. Canceling the call still stops them.

Your own workflows keep their checks, including workflows you pass as processors. They still stop when another server cancels the run.
