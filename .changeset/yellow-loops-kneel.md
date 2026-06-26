---
'@mastra/auth': patch
'@mastra/auth-auth0': patch
'@mastra/auth-better-auth': patch
'@mastra/auth-clerk': patch
'@mastra/auth-cloud': patch
'@mastra/auth-firebase': patch
'@mastra/auth-okta': patch
'@mastra/auth-studio': patch
'@mastra/auth-supabase': patch
'@mastra/auth-workos': patch
'@mastra/core': patch
---

Improved auth package builds by removing the direct core dependency from auth providers while preserving the existing public auth APIs.
