---
'@mastra/core': patch
---

Fixed `messageHistory` token budgets letting the start of the conversation history move forward on every run without ever trimming. When the newest messages weighed between the trim target and `maxTokens`, memory loaded a fixed page of messages and never recorded a cut, so the history start changed each turn and prompt caching broke. Memory now loads enough history for the token limit to trim it and remember where it cut, so the history start stays put between trims. Fixes [#31469](https://github.com/mastra-ai/mastra/issues/31469).
