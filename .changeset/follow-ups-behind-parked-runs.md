---
'@mastra/core': patch
---

Follow-up messages now queue behind a parked run and behind a follow-up that is still becoming a run. A run waiting on a tool suspension (a generation, a question to the user) or a tool approval has finished streaming but is not over; `followUp` treated that as idle, so every message sent meanwhile was folded into the resumed run together and answered as one batch. Such messages now wait in the follow-up queue (visible as `queuedFollowUpItems`) and run one at a time once the parked run has ended; the queue also stops draining into a parked run. Two follow-ups sent to an idle session in quick succession no longer race: the second queues behind the first instead of being delivered into the run the first is starting.
