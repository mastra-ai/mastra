---
'@mastra/auth-clerk': minor
---

Added IUserProvider implementation for Studio login support. `getCurrentUser` extracts and verifies JWT tokens from Authorization headers or `__session` cookies, and `getUser` fetches full user details from the Clerk Users API. Falls back to JWT claims when the API is unreachable.
