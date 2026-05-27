---
'@internal/playground': patch
---

Agent builder mobile polish:

- On the edit page initial step, once generation has finished (name, description, instructions, and optional model present) and the builder is not streaming, the chat panel now shows two CTAs at the bottom — "Chat with my agent" (navigates to the agent's view page) and "See configuration" (advances the wizard to the configuration step).
- On the final wizard step, the chat panel is hidden on mobile so the profile fills the viewport.
- The "Delete agent" and "Add to library / Remove from library" buttons in the configuration profile header are hidden on mobile, since both actions are already available from the mobile 3-dots menu.
- The edit-page mobile 3-dots menu now includes a "View agent" entry that navigates to the agent's view page.
- The view-page mobile 3-dots menu now includes an "Edit agent" entry (owner-only) that navigates back to the agent's edit page.
- The agent view page empty state no longer gets cut off at the top on small viewports — content now flows from the top of the scroll area on mobile while keeping the centered layout on desktop.
- Channel integration panel scrolls correctly inside the configuration step, and the configuration card has bottom breathing room on mobile.

Desktop layout is unchanged.
