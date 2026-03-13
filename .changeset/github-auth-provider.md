---
'@mastra/auth-github': minor
---

Added new GitHub OAuth auth provider for Mastra. Authenticate API requests using GitHub access tokens with built-in SSO support for the full GitHub OAuth flow, cookie-based sessions, and user awareness in Mastra Studio.

**Usage:**

```typescript
import { Mastra } from '@mastra/core'
import { MastraAuthGitHub } from '@mastra/auth-github'

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthGitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      allowedOrgs: ['mastra-ai'],
    }),
  },
})
```

**Access control:** At least one restriction is required. Restrict access by GitHub username, organization (case-insensitive), or team (case-insensitive):

```typescript
new MastraAuthGitHub({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  allowedUsers: ['paulchristo'],
  allowedOrgs: ['mastra-ai'],
  allowedTeams: ['mastra-ai/engineering'],
})
```
