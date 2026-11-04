---
'@mastra/factory': minor
---

Added one-click Mastra Gateway setup to Factory. When Factory signs users in with their Mastra account, onboarding, factory creation, and Settings > Models offer **Mastra Gateway** first. One click creates a gateway key on the user's Mastra organization and stores it with their model credentials, so every model runs on the organization's Mastra credits without provider keys.

- The Mastra Gateway option says it is billed to the organization's Mastra credits and shows the balance left, before the user connects it.
- Organization admins add credits from Factory, both from the **No gateway credits left** warning and from a run that failed for lack of credits. A saved card is charged right away; without one, Factory opens the payment page in a new tab, and the balance updates when the user comes back.
- Members who are not admins of the Mastra organization are told to ask an admin, since only admins can buy credits.
- Factory creates no key and buys no credits while the user's Mastra session is on a different organization than the Factory, and asks them to sign in again with the Factory's organization.
- Removing the Mastra Gateway credential also revokes its key on Mastra.
- With other auth providers, Factory lists Mastra Gateway as a regular API-key provider.
