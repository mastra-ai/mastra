---
'@mastra/factory': patch
---

Slack now gets members of a Factory set up instead of failing their first run.

- **Connect account** starts Sign in with Slack straight away instead of opening settings first, then returns to the member's setup page for their Factory.
- A member whose Factory runs the Slack threads they start on their own model account, and who has no model connected, gets a **Finish setup** card that links to their setup page, instead of a run that fails with **Provider sign-in required**.
