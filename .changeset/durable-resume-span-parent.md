---
'@mastra/core': patch
---

Fixed DurableAgent traces after a resume or crash recovery. The resumed or recovered agent run is now nested under the original agent run, so the trace stays a single tree instead of splitting into two root spans.

Crash recovery traces are also complete now: the agent run left open by the stopped process is ended with an `interrupted` status, and the recovered agent run is ended when the run finishes. Previously a recovered trace could be missing from the trace list or show only the part before the crash.
