---
'@mastra/auth-supabase': minor
'@mastra/server': patch
---

Added Studio login support for Supabase auth provider. Implements IUserProvider (getCurrentUser, getUser), ICredentialsProvider (signIn, signUp via Supabase Auth), ISSOProvider (OAuth 2.1 Server flow with PKCE), and ISessionProvider (encrypted cookie sessions). Supports both credentials and SSO login — configure either, both, or neither. Includes consent endpoint for first-party OAuth approval.
