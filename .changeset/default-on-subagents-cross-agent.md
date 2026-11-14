---
'mastracode': minor
'@mastra/code-sdk': minor
---

Subagents and experimental cross-agent communication are now on by default. A settings file without these values gets the built-in Explore, Plan and Execute subagents and the agent connection tools. Turn them off with `/subagents` and the "Experimental cross-agent communication" toggle in `/settings`. A value already saved in `settings.json` is kept, so existing installs that stored `false` stay off until you turn them on.

Embedded clients that don't want cross-agent communication can opt out explicitly:

```ts
const { controller } = await createMastraCode({ crossAgentSignals: false });
```
