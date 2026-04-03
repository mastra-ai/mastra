---
"@mastra/server": patch
"@mastra/auth-studio": patch
"@mastra/playground-ui": patch
---

fix(auth): prevent 5-minute logout in studio deploys

Studio deployed instances were logging users out every 5 minutes because the session refresh mechanism wasn't working correctly.

- `@mastra/server`: Add `POST /auth/refresh` endpoint that refreshes the session and returns new session headers
- `@mastra/auth-studio`: Update `refreshSession()` to call shared API's `/auth/refresh` endpoint to get a fresh access token
- `@mastra/playground-ui`: Add `fetchWithRefresh()` utility that auto-retries requests on 401 after refreshing the session, and update `useCurrentUser` hook to use it
