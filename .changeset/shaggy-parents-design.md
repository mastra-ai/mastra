---
'mastra': minor
'@mastra/playground-ui': patch
---

Redesigned the agent page in Studio to separate configuration from usage.

**Settings moved out of the side panel.** The right-hand information panel on the agent chat page is gone. Agent configuration (description, model, tools, workflows, skills, scorers, system prompt, memory configuration, and channels) now lives in a full-width Settings view with Overview, Memory, and Channels tabs. Open it from the new Settings button at the top right of the chat — it replaces the chat in place with a smooth transition while the thread sidebar stays visible, and it is deep-linkable at `/agents/:agentId/settings`. Channels moved out of the tool tab bar into this view (old `/channels` links redirect), and the agent header now copies the agent id when you click the title, with an icon-only share button beside the Settings toggle.

**Run options follow their frequency of use.** Request context lives in a popover beside the model settings in the chat composer, and tracing options moved to the tab bar — adjusting a test run never requires leaving the conversation. The per-thread Traces shortcut was removed from the composer; the Traces tab covers it.

**Left sidebar focuses on usage.** The thread list now ends with a Memory card showing the memory setup at a glance (recent-messages window, semantic recall, working memory, observational memory, plus a live observation progress bar while it streams) and a preview of the working memory. Clicking the card smoothly expands it in place into the full live memory view. The Editor tab shares this same resizable sidebar — only its content changes between routes, so the panel keeps its size. On desktop the sidebar is always visible (resizable, no longer collapsible); on mobile it becomes an edge drawer.

**Browser sessions simplified.** Agent browser sessions now display in the centered overlay only — the sidebar display mode was removed.
