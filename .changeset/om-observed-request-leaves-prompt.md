---
'@mastra/memory': patch
---

Fixed Observational Memory putting a run's original user message back into the prompt after it had been observed. In a long run the old request appeared again many steps later, next to observations that already recorded it and what was done about it, and could read as a new instruction. Once the model has acted on the request, the observations now carry it. Tool results and messages the model has not read yet still stay in the prompt until it reads them.
