---
'mastracode': minor
'@mastra/code-sdk': minor
---

Subagents and experimental cross-agent communication are now on by default. A settings file without these values gets the built-in Explore, Plan and Execute subagents and the agent connection tools. Turn them off with `/subagents` and the "Experimental cross-agent communication" toggle in `/settings`. A value already saved in `settings.json` is kept, so existing installs that stored `false` stay off until you turn them on.

The subagents default applies to the Mastra Code TUI, headless runs and ACP sessions. `createMastraCode()` still registers only the subagents passed in `config.subagents`. Cross-agent communication follows the global setting in `createMastraCode()` too, so embedded clients that don't want it can opt out explicitly:

```ts
const { controller } = await createMastraCode({ crossAgentSignals: false });
```
