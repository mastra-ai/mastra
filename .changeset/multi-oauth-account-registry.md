---
'@mastra/code-sdk': patch
'mastracode': patch
---

Added multiple OAuth accounts per provider. Sign in with as many accounts per provider as you like — `/login` on an already-connected provider now opens an account manager where you can add another account (added accounts stay inactive until you select one), switch the active one, re-authenticate, or remove accounts. Accounts carry labels (email for ChatGPT/xAI, GitHub login for Copilot), and credentials keep the same `auth.json` slot format so existing setups are untouched.
