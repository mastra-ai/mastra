---
'@mastra/factory': patch
---

Asking a parked card's agent to resume now moves the card back into its lane.

Messaging the thread of a card parked in Intake previously changed nothing on the board: the agent either kept chatting with the card at rest, or its transition request dispatched a second run racing the conversation. The bound agent's session is now told when its card rests in Intake — answer questions freely, request the governed transition before resuming work — and a transition requested by the seat's own agent no longer starts a duplicate run for that seat; the conversation the user is already in carries the resumed work.
