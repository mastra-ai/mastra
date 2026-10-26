---
'@mastra/factory': patch
---

Fixed **Settings → Models** showing a provider as **Signed in** after its sign-in stopped working. When Factory cannot renew an expired subscription sign-in (for example Anthropic), the provider now shows **Sign-in expired** and its menu offers **Sign in again**. Before, chats failed with "Not logged in to Anthropic." while Settings still said Signed in. The warning clears after the next successful renewal or a new sign-in.
