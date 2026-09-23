---
'@mastra/core': patch
---

Hardened Harness terminal handoff against revoked or settled grants.

- A resume whose deferred admission was cancelled or fenced now surfaces the terminal outcome without invoking the provider.
- A cached suspended turn is no longer re-parked when its admission already settled.
- A settlement retry converging with the winner no longer emits a duplicate `agent_end`.
- A retried resume after restart recovers the terminal output from the committed admission's durable evidence.
- Settlement now verifies the registered finalizer identity matches the admitted one before committing.
- Adopted duplicate streams settle through the canonical run-completion path.
- The in-memory adapter keeps the admission pending when the commit payload cannot be cloned, and no longer overwrites completed canonical evidence on a fresh-intent retry.
