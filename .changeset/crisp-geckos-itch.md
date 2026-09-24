---
'@mastra/inngest': patch
---

Fixed a type error where Inngest workflows created with init() rejected a first step that shares the workflow's input schema when that schema uses .default() or coercion. The workflow's .then() now compares the step against the parsed input type (defaults applied), while run.start() and cron inputs keep accepting the raw caller input where defaulted fields may be omitted. Fixes https://github.com/mastra-ai/mastra/issues/24409
