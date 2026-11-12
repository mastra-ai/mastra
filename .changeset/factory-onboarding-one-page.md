---
'mastra': patch
---

Redesigned Factory onboarding as one page, so setting up a factory no longer feels like a wizard and every dead end says why and what to do next.

- **One page, four sections.** Codebase, Work, Accounts and Model sit on one page (three in local mode). Finished sections collapse to a summary you can change in place, and Create factory sits below them.
- **Accounts says who pays for model usage.** Pick one company account, company for Factory work with personal accounts for sessions, or everyone's own account. Model, right below, shows only the accounts that answer needs.
- **Gateway or your own provider.** Each account switches between the recommended Mastra Gateway and your own provider, picked from one searchable list of API key and subscription providers. Cancelling a key or sign-in dialog keeps the provider you already had.
- **GitHub problems explained in place.** GitHub App results show in the Codebase section with the matching way out: Mastra Platform settings, Refresh, Connect GitHub again, Sign in or Sign out. A GitHub App installed on a personal account that a team shares explains why Factory can't use it, on every visit.
- **Create factory says what is missing.** While it is disabled, a line above it names the account to connect or the model to pick.
- **Theme and account menu.** The onboarding page has an account menu with System, Light and Dark themes and Sign out.
