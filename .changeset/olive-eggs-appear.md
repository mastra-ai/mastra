---
'@mastra/factory': patch
---

Improved chat scrolling in the factory. Sending a message now scrolls once and parks it near the top with room under it, and the view stays on the agent's newest output — tool progress, subagents, the streamed reply — instead of standing still or jumping back up to what you just sent.

Scroll up to read back and the chat stops following. Return to the bottom and it picks the stream up again. The jump-to-latest button no longer flickers when you send a message.

The room under the live turn is released when the run ends, so a finished conversation settles against the composer instead of leaving most of the window blank.
