---
'@mastra/memory': patch
---

Fixed Observational Memory keeping a run's original user message in the prompt after it had been observed. Once memory has observed the request and the model has answered it, the request leaves the prompt and the observations stand in for it for the rest of the run, as they already did on later turns.

Keeping it had two costs:

- **A stale instruction.** Many steps later the old request still appeared next to observations that already recorded it and what was done about it, and could read as a new instruction.
- **A lost prompt cache on the next turn.** The request sat ahead of every tool call the run made after it, and the next turn dropped it. So the next turn's prompt matched the cached one only up to that point, and every one of those tool calls had to be written to the cache again. In a run with about 40k tokens of tool results after the request, the next turn now reuses nearly all of its prompt from cache instead of almost none.

Tool results and messages the model has not read yet still stay in the prompt until it reads them. The request message stays stored; only details the observer did not copy into its observations, such as a pasted link, are no longer sent once it has been observed.
