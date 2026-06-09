---
"@mastra/core": patch
---

Fix CompositeAuth to proxy credentials provider methods (signIn, signUp, isSignUpEnabled, requestPasswordReset, resetPassword) from inner providers, so buildCapabilities() correctly advertises credentials login and Mastra Studio shows the sign-in form when a credentials provider is present.
