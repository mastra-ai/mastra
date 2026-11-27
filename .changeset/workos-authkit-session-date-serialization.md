---
'@mastra/auth-workos': patch
---

Fix `handleCallback` failing with "Data is not JSON serializable" when sealing the AuthKit session cookie. The WorkOS SDK returns `Date` objects for the user's `createdAt`, `updatedAt` and `lastSignInAt` fields, which the AuthKit session sealer rejects; these are now normalized to ISO strings before the session is sealed.
