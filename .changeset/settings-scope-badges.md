---
'@mastra/factory': patch
---

Settings now say who each block applies to. Every section heading carries a scope label: **Personal** for your own account, chats and credentials, **Factory-wide** for what everyone working in this factory shares, **Org-wide** for what the whole organization shares such as custom providers and GitHub CLI tokens, and **Deployment-wide** for the handful of settings that live in the server's own settings file and reach every factory on it.

Writing the labels turned up blocks that claimed the wrong owner, and those moved to where they belong:

- **Thinking level, auto-approve tools, smart editing, notifications and the tool-permission rows** sat under Personal, but a settings page has no chat session of its own, so they all write the factory-level session that every member of the factory shares. They now read Factory-wide, and say plainly that auto-approve, smart editing and permissions reset when the server restarts.
- **Base and per-mode thinking defaults** claimed Factory-wide while writing one settings file shared by every factory on the server. They are their own Deployment-wide block now, sitting together so a mode row that follows the base level shows the row it follows.
- **GitHub and Linear issue syncing** claimed Factory-wide while storing one row per person. They read Personal, and say that teammates choose their own.
- **Linear routing** is org-level config that happens to name a factory, so it reads Org-wide.
- **"Create work items for new Slack threads"** sat in a Personal block on the Slack page while flipping a switch on the factory itself. It has its own Factory-wide block now, next to the per-account routing that really is personal.
- **Model packs**: choosing your default pack is personal, but creating or removing one changes the list for the whole org, which the block now says.
- **Factory skills** ship with the server and are identical on every factory, so they read Deployment-wide rather than implying this factory has its own.

Where the same form exists at two scopes, the label becomes a switch instead of a second copy of the form, and switching slides the old content out and the new content in from the picked side, so the change is visible even when both scopes are configured alike:

- **Provider access** switches between your own credentials and the org-wide ones (org admins only). The sign-in and API-key tabs moved up next to the heading, so the section leads with one row of controls instead of two. Each row shows one status and one action for the picked scope; from the personal view a provider you have no credential for reads "Covered by org" when the org already has one. Signing in or adding a key no longer asks who it is for; the switch already decided.
- **Observational memory** switches between your interactive chats and Factory runs instead of stacking two identical forms.
