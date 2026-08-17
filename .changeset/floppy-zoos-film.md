---
'@mastra/core': patch
---

Skills discovery no longer blocks agent turns: the skills processors serve the cached catalog and revalidate in the background, and refresh swaps the catalog atomically. Mid-session skill changes now appear one turn later; pass blockingRefresh: true to SkillsProcessor or SkillSearchProcessor to restore same-turn freshness by awaiting the refresh before the first step.
