---
'@mastra/auth-studio': patch
---

`MastraAuthStudio` now automatically creates a personal organization for users who don't belong to one yet, and can check whether a user is an organization admin — matching the behavior already available in `MastraAuthWorkos` and `MastraAuthBetterAuth`. This lets hosts like a self-hosted MastraCode deployment authorize organization-level actions without users needing to manually set up an organization first.
