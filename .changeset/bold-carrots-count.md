---
'@mastra/playground-ui': patch
---

Added SessionExpired component and is401UnauthorizedError utility to handle 401 Unauthorized errors gracefully. When a user's token expires and refresh fails, they now see a clear 'Session Expired' message with a 'Log In' button instead of a broken/empty UI state.
