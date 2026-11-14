---
'mastracode': minor
'@mastra/code-sdk': minor
---

Experimental cross-agent communication is now on by default. A settings file without this value gets the agent connection tools. Turn it off with the "Experimental cross-agent communication" toggle in `/settings`. A value already saved in `settings.json` is kept, so existing installs that stored `false` stay off until you turn it on.

Cross-agent communication follows the global setting in `createMastraCode()` too, so embedded clients that don't want it can opt out explicitly:

```ts
const { controller } = await createMastraCode({ crossAgentSignals: false });
```
