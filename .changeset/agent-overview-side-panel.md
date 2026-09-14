---
'mastra': patch
---

Replaced the agent **Overview** tab in Studio with a collapsible side panel.

The models, capabilities (agents, tools, workflows, processors, skills, scorers), memory, channels and system prompt of an agent are now shown in a resizable panel on the right of the Studio frame. Toggle it with the panel button in the top-right header on any agent page (Chat, Editor, Evaluate, Review, Traces); its open state and width are remembered across reloads. Long lists show the first 10 items with a `+N` button to reveal the rest.

Opening `/agents/:agentId` (and the old `/overview` and `/settings` URLs) now lands on the agent chat.

Press `]` to toggle the overview panel from the keyboard (tooltips on the header button show the shortcut). The **Share** action in the agent header is now an icon button.
