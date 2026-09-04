---
'@mastra/factory': patch
---

The factory supervisor can now answer a worker run that is parked on an ask_user question and resume it, through the new approval-free, audited factory_answer_suspension tool (available on notification-woken turns too). The question and its options are captured when the run parks and shown in the finding. Health findings for runs parked on a question now suggest answering instead of a retry, which only re-entered the same parked question. Anything the supervisor cannot answer confidently (a plan awaiting approval, an unfamiliar tool, an answer outside the offered options, a run whose seat is gone) is escalated to a person instead of guessed; a question that was already answered is reported as handled. Delivery of an answer is best-effort against the live worker session: after a process restart the parked question must be answered from the session directly.
