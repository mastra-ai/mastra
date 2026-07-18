---
'mastra': patch
---

Removes the `Environment "production" doesn't exist. Create it?` confirmation on first deploy. It always fires on a fresh project, always gets 'yes', and the whole point of `mastra deploy` is 'ship this to production' — the extra keypress is pure noise. The confirmation still runs for non-standard environment names (typo protection against `--env prodcution`).
