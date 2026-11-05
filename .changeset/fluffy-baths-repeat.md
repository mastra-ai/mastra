---
'@mastra/factory': minor
---

Added one-click Mastra Gateway setup to Factory. When Factory signs users in with their Mastra account, onboarding, factory creation, and Settings > Models offer **Mastra Gateway** first. One click creates a gateway key on the user's Mastra organization and stores it with their model credentials, so Mastra Gateway models run on the organization's Mastra credits without provider keys.

- The Mastra Gateway option says it is billed to the organization's Mastra credits and shows the balance left, before the user connects it.
- When the organization runs out of credits, the **No gateway credits left** warning and the failed run both offer **Add credits**, which opens the organization's add-credits page on Mastra in a new tab. The balance updates when the user comes back to Factory.
- Members who are not admins of the Mastra organization are told to ask an admin, since only admins can buy credits.
- New gateway setups start on Claude Opus 5.5.
- Factory creates no key while the user's Mastra session is on a different organization than the Factory, and asks them to sign in again with the Factory's organization.
- With other auth providers, Factory lists Mastra Gateway as a regular API-key provider.
