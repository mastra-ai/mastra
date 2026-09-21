---
'@mastra/playground-ui': patch
---

Made Studio request context per entity and unified run options. The global Request Context page, sidebar entry, `g r` shortcut, and header preset dropdown are removed. Each agent, workflow, and tool now has a single **Run options** popover next to its run action (agent chat composer, agent editor top bar, workflow run form, tool executor) holding the request context editor and, for agents and workflows, the tracing options. Values are saved in the browser per entity, with a JSON editor and presets always available even without a `requestContextSchema`. Tracing options are now applied on explicit Save instead of on every keystroke. Added the `@mastra/playground-ui/domains/request-context` (`RequestContextProvider`, `useRequestContext`, `RequestContextEditor`) and `@mastra/playground-ui/domains/run-options` (`RunOptionsPopover`, `RunOptionsContent`) entry points and removed the `@mastra/playground-ui/store/playground-store` entry point.
