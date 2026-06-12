---
'@mastra/playground-ui': patch
---

Added conditional tool-mock cases and faithful mock re-runs to dataset experiments in Mastra Studio.

The Run Experiment dialog's mock editor gains a 'Conditional cases' mock kind: define args-to-answer cases where the first case whose args match the call answers it (with an output or a thrown error), and choose what happens when no case matches — fail the item (the default) or run the live tool.

Experiments run with tool mocks can now be re-run per item from the experiment page: the run's mock configuration is persisted on the experiment record, so 'Re-run item with replay' rebuilds the exact same mocks (combined with the replay policy on replay+mock runs). Runs that can't be rebuilt faithfully keep a disabled button with the reason — function mocks are code-only, and older runs don't store mock values.
