---
'@mastra/auth-workos': patch
---

Added organization management and host integration to MastraAuthWorkos so it can be passed directly to a server host without a wrapper adapter. The provider now bootstraps a personal organization for new users (ensureOrganization), checks organization admin roles (isOrganizationAdmin), and resolves its redirect URI from the host public URL during init when not configured explicitly.
