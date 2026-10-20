---
'@mastra/factory': patch
---

Failed Factory skill runs now keep their real cause. A run that ends in error records the run's own error message with a specific failure code (`run_credentials_unavailable` for credential and auth errors, `run_failed` otherwise), both retryable, instead of "Factory skill run ended in error." with `unknown`. A decision that starts a new attempt no longer shows the previous attempt's error.

You can now tell a busy work session from a stuck one. `factory_inspect_work_item` shows whether each session is mid-run and when its thread last moved, the factory-sessions summary marks a running worker that has gone quiet for 10 minutes, and `factory_signal_session` returns `delivered: "mid-run"` instead of `"woken"` when the target was already running. Workers are also asked to send a progress report after each plan step.
