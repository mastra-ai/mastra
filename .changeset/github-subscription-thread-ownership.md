---
'@mastra/factory': patch
---

Deliver GitHub pull request signals to the session that actually owns the subscribed thread, and skip subscriptions whose thread this deployment does not hold.

A subscription records the Factory project as its resource, but an unscoped session registers under its own id, so delivery looked for the thread under a resource that did not own it and failed with "Thread not found" on every matching event. Delivery now reads the thread from storage to find its owning resource. A subscription naming a thread that is absent is skipped rather than failed, so a pull request's events reaching a deployment that never owned the thread no longer fabricate a session or retry in a loop.
