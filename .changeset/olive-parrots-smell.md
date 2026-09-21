---
'@mastra/playground-ui': patch
---

Fixed secondary text rendering at full strength across the studio. Tool call headers, chat events, token budgets, chart tooltips, the theme toggle and the skill dialog all spelled their dimmer text tiers with class names the stylesheet never defined, so those elements silently inherited body ink and every tier looked the same. They now use the semantic inks, and the hierarchy reads again.
