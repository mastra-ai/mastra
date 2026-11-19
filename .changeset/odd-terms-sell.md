---
'@mastra/playground-ui': minor
---

Word searches over long ranges now run in chunks when the observability API supports it. The Traces and Spans histograms fill in as each chunk arrives, with the part not yet searched shown as pending, and a status line reads "Searched the last 14 of 30 days…" with Stop and Continue. A chunk that fails keeps the results found so far.
