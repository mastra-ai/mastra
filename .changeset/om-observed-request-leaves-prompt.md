---
'@mastra/memory': patch
---

Fixed Observational Memory putting a run's original user message back into the prompt after it had been observed. In a long run the old request appeared again many steps later, next to observations that already recorded it and what was done about it, and could read as a new instruction. Once memory has observed the request and the model has answered it, the request is no longer sent: the observations stand in for it for the rest of the run, even when the run still has steps to go. The message stays stored, but it is not sent again, so details the observer did not copy, such as a pasted link, are no longer in the prompt. Tool results and messages the model has not read yet still stay in the prompt until it reads them.
