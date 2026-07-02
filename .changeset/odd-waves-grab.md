---
'@mastra/auth-auth0': patch
'@mastra/auth-better-auth': patch
'@mastra/auth-clerk': patch
'@mastra/auth-cloud': patch
'@mastra/auth-firebase': patch
'@mastra/auth-google': patch
'@mastra/auth-neon': patch
'@mastra/auth-okta': patch
'@mastra/auth-studio': patch
'@mastra/auth-supabase': patch
'@mastra/auth-workos': patch
---

Rebuilt published type declarations so the bundled auth base class no longer carries nominal `#private`/`protected` brands. Provider instances now stay assignable to `MastraAuthProvider` and the new `IMastraAuthProvider` types from `@mastra/core` in strict TypeScript configs (#18682).
