---
'@mastra/inngest': patch
---

Fixed tool approvals on Inngest agents running a tool more than once, or running a tool nobody approved.

- Approving the same tool call twice now fails the second approval with `AGENT_RESUME_ALREADY_CLAIMED` instead of running the tool again ([#27485](https://github.com/mastra-ai/mastra/issues/27485)).
- When several tool calls wait for approval, approving one now runs only that tool. Approving the rest in any order runs each tool once and delivers the final answer once ([#27925](https://github.com/mastra-ai/mastra/issues/27925)).
- The stream returned by approving one of several waiting tool calls now ends when the run waits on the others again.
