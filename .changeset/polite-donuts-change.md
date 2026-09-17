---
'@mastra/github-signals': minor
---

Added authorization for GitHub App bot comments when the app is owned by the repository organization or by a user with authorized repository access. Explicitly ignored bots and bots whose app ownership cannot be resolved remain denied.

```ts
import { GithubSignals } from '@mastra/github-signals';

const githubSignals = new GithubSignals({
  authorizedPermissions: ['admin', 'maintain', 'write'],
  authorizedBots: ['coderabbitai[bot]', 'devin-ai-integration[bot]'],
});
```

Bots not listed in `authorizedBots` can now trigger notifications when their GitHub App is owned by the repository organization or by a user with one of the configured `authorizedPermissions`.
