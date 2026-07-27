---
'@mastra/factory': patch
---

Authorize factory session access by org membership instead of active org. Switching the active organization on the platform no longer locks the session owner out of their own sessions ("Factory session X is not available to the current user"); any org in the user's memberships now satisfies the org check, while the exact user match stays strict.
