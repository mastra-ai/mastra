---
'@mastra/observability': patch
---

Fixed span errors exposing data on traces that use `tracingOptions.hideInput` or `tracingOptions.hideOutput`. Error messages, stack headers, and error details often quote the input or output these flags hide, such as a tool rejecting a user's value or a provider echoing a refused prompt. On these traces, exported span errors now replace the message with `[REDACTED]` and drop error details other than the provider status code, URL, and retry flag. The error id, name, domain, category, and safely correlated stack frames are kept, so failures can still be traced to code; unrecognized stack formats are dropped rather than risking disclosure. Traces without these flags are unchanged.
