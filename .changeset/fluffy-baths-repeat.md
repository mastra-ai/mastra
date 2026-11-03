---
'@mastra/factory': minor
---

Added one-click Mastra Gateway setup to Factory. When Factory signs users in with their Mastra account, onboarding, factory creation, and Settings > Models offer **Mastra Gateway · Recommended**. One click creates a gateway key on the user's Mastra organization and stores it with their model credentials, so every model runs on the organization's Mastra credits without provider keys.

- Factory creates no key while the user's Mastra session is on a different organization than the Factory, and asks them to sign in again with the Factory's organization.
- Removing the Mastra Gateway credential also revokes its key on Mastra.
- Factory warns with an **Add credits** link when the organization has no gateway credits left, including on a run that failed for lack of credits.
- With other auth providers, or without auth, Mastra Gateway stays available as a regular API-key provider.
