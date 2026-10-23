---
'@mastra/core': minor
'@mastra/react': patch
---

A message sent into a running thread (a steer) now shows up in Studio and other subscribers the moment it is accepted, instead of only when the agent reads it. Core publishes a pending user-message chunk with the signal's id at acceptance, and the React accumulator shows it as a pending bubble and settles it into the delivered message without duplicating it.

A follow-up queued behind a running thread now shows in Studio as a queued bubble right away, and a cancelled one disappears. Core publishes a queued user-message chunk when the follow-up is queued and a `data-user-message-cancelled` chunk when it is cancelled.
