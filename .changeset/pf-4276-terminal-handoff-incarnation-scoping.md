---
'@mastra/core': patch
---

Hardened Harness terminal handoff recovery and fencing.

- Terminal admission probes are scoped by session incarnation so a recreated session cannot resolve a previous incarnation's grant.
- Stale-resume recovery reconciles an already-committed admission instead of failing the interaction as abandoned.
- Durable terminal probes no longer require a locally registered finalizer; a live pending grant without one fails closed.
- Duplicate and re-admission envelopes that carry a cancelled or fenced stored row surface the durable outcome instead of dispatching the provider.
- A duplicate waiting on durable evidence surfaces a cancellation or fencing tombstone promptly.
- Caller mutation of the terminal admission seed after the call starts no longer changes the persisted admission.
- A cold settlement retry no longer double-counts tokens.
- Pre-commit failures and already-terminal admissions drain retained terminal observers instead of stranding them.
