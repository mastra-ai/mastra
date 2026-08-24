---
'@mastra/memory': patch
---

Observational memory now detects observer/reflector output where a multi-line block repeats many times (a model repetition loop). Previously such output could slip past the degenerate-output check and balloon stored observations, causing constant synchronous reflection churn; it is now rejected and retried like other degenerate output.
