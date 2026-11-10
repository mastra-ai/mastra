---
'@mastra/platform': patch
---

`PlatformMemory` fixes for read-only runs and working memory:

- A read-only run (`memory: { options: { readOnly: true } }`) now sees the thread's observations and unobserved messages, read through the Memory instance's read-only context route. Before, it got no stored context at all. It still saves nothing and starts no observation.
- The `workingMemory` option now delivers what it says: `readonly` and `tool` add the resource's stored working memory to each run's prompt, read fresh each run; `tool` also tells the agent to update it with `updateWorkingMemory`; `off` leaves it out. Before, stored working memory never reached the prompt in any mode.
