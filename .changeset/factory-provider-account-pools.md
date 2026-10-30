---
'@mastra/factory': minor
---

Model settings now show each connected provider's accounts as a pool, under both Personal defaults and Factory defaults, once a provider has two or more accounts. Every account shows its name, whether it is a sign-in or a saved key, which one is active, and whether it is ready, cooling down after a rate limit (with the time it is back), or failing to authenticate. You can make an account active, rename it, remove it, and set the order routing tries them in, by dragging or with the move up and move down buttons. Signing in or saving a key for a provider that is already connected adds another account to its pool and makes it active. Signing out removes only the active account, and removing a key, after a confirmation, removes only an API key and never a sign-in; the next account takes over. Only organization admins see and manage the Factory defaults pool.

The transcript now shows a notice when a run switches to another account or falls back to another model route, naming the account or route it switched to and why, for example `Switched Anthropic account: Work Max → Personal Pro (rate limit)`.
