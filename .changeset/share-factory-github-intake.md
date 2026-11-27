---
'@mastra/playground-ui': minor
---

Added Factory's GitHub intake card to `@mastra/playground-ui/domains/factory`. It shows the GitHub App's connection status and installations, and lets users pick repositories as intake sources.

The card takes the host's status and repository queries and its Connect and Manage buttons, so each app wires its own API:

```tsx
import { GithubIntakeCard } from '@mastra/playground-ui/domains/factory';

<GithubIntakeCard
  config={intakeConfig}
  listed={listed}
  selection={githubSelection}
  dependabotSelection={dependabotSelection}
  statusQuery={githubStatusQuery}
  repositoriesQuery={linkedRepositoriesQuery}
  connectButton={<ConnectGithubButton />}
  manageButton={<ManageGithubButton />}
/>;
```
