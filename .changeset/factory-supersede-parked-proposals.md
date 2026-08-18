---
'@mastra/factory': patch
---

Retire a parked proposal when the run it asked for starts anyway. Approving a
proposal mints a fresh decision rather than dispatching the parked one, so the
original stayed `proposed` forever and the card kept asking to start a run that
had already finished. The dispatcher now dismisses proposals for the same work
item and role as any `invokeSkill` it dispatches, so the waiting badge only ever
marks a loop that is genuinely stopped.
