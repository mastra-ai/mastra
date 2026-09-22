---
'@mastra/factory': minor
---

**Added a `platform.github` config key to `MastraFactory`** for overriding the GitHub integration the factory installs itself.

When Platform credentials are present, `MastraFactory` installs a `PlatformGithubIntegration` automatically. You can now change its event handlers and app slug from the factory config, instead of constructing the integration and re-declaring the auto-install guard yourself:

```ts
// Before
import { PlatformGithubIntegration } from '@mastra/factory/integrations/platform/github/integration';

new MastraFactory({
  storage,
  integrations: [new PlatformGithubIntegration({ rules: { issueOpened }, slug: 'factory-app' })],
});

// After
new MastraFactory({
  storage,
  platform: { github: { rules: { issueOpened }, slug: 'factory-app' } },
});
```

For example, replacing `issueOpened` lets a newly created GitHub-issue work item land on the board its existing labels select instead of defaulting to Work. `slug` falls back to `platform.githubAppSlug` when omitted.

An explicit integration with id `github` in `integrations` still takes precedence, which makes `platform.github` a no-op; the factory logs a warning rather than ignoring it silently, and warns the same way when no Platform credentials and no explicit GitHub integration are present.