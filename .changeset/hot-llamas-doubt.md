---
'@mastra/factory': patch
---

Reworked the settings pages so every option reads as the same kind of row.

- **Work Intake** is now one section per source — GitHub issues, Linear issues, and Linear routing — instead of both sources stacked in a single card. Linear's connection state (connect, reconnect, expired, workspace name) moved into its section header. Both sources now use the same picker: one search box that spans every Linear team instead of a search per collapsed team, with the repositories and projects listed straight away, inset from the card edges and scrolling in the same scroll area the rest of the app uses.
- **Memory** renders observational-memory options as regular settings rows instead of a stacked block with its own padding.
- **Models** shows the Provider access tabs above the card instead of inside it, and each provider is a settings row rather than a data-list row.
- **Repositories** gives the setup and teardown commands one row each, per repository, with the command field on the right like every other setting and a line saying when it runs. Both save on their own when you leave the field, so there is no save button to hunt for.
- **Repositories** lists the repositories you can link the same way — a standard search field, rows aligned with the card, and grouped under "Linked" and "Available" instead of each row drawing its own box.
- Section actions such as "Manage GitHub connection" now sit on the right of the section title instead of below the description.
