# @mastra/teams

## 0.1.0-alpha.0

### Minor Changes

- Added @mastra/teams, a Microsoft Teams channel provider. Register `TeamsProvider` on `Mastra.channels` to route Teams conversations to agents with streaming replies. ([#25331](https://github.com/mastra-ai/mastra/pull/25331))

  Two credential modes are supported. Self-managed mode uses an existing bot registration's `appId`/`appPassword`. Delegated mode takes a scope-aware `tokenResolver` and provisions a dedicated bot per agent through Microsoft Graph and the Teams Developer Portal.

  ```typescript
  import { Mastra } from '@mastra/core/mastra';
  import { TeamsProvider } from '@mastra/teams';

  const teams = new TeamsProvider({
    baseUrl: 'https://my-app.example.com',
    appId: process.env.TEAMS_APP_ID,
    appPassword: process.env.TEAMS_APP_PASSWORD,
  });

  const mastra = new Mastra({
    agents: { myAgent },
    channels: { teams },
  });

  await teams.connect('my-agent');
  ```

### Patch Changes

- Added the missing `README.md` and `CHANGELOG.md` for `@mastra/teams` so `npm install @mastra/teams` ships with package documentation. ([#25480](https://github.com/mastra-ai/mastra/pull/25480))

- Updated dependencies [[`ed67acc`](https://github.com/mastra-ai/mastra/commit/ed67acc3213d469ed69610c304c604693cfec383), [`5f1efad`](https://github.com/mastra-ai/mastra/commit/5f1efad5c2230a4de715cad3f01859b4ff9d255b), [`75c2ee1`](https://github.com/mastra-ai/mastra/commit/75c2ee1280a5441eb66c31f23a53a52b42244686), [`9a35897`](https://github.com/mastra-ai/mastra/commit/9a3589783a40157759f939f5c63bba3c8aef1c1c), [`d3a22a7`](https://github.com/mastra-ai/mastra/commit/d3a22a78f12e094118ce80ec35b63987009644e2), [`e4e0f90`](https://github.com/mastra-ai/mastra/commit/e4e0f9000d73396609ae2f2b6c31259ade43078c), [`caf94f9`](https://github.com/mastra-ai/mastra/commit/caf94f9c1927f737370b6118264bd16c7210a765), [`6c9f7ab`](https://github.com/mastra-ai/mastra/commit/6c9f7abf9bdce0a52450398b31d497519465bb80), [`91196d5`](https://github.com/mastra-ai/mastra/commit/91196d5a6d582c0f494622d0378f33e22d881659), [`f36019c`](https://github.com/mastra-ai/mastra/commit/f36019c24193e0d29f920663851198bf45e3d12f)]:
  - @mastra/core@1.72.0-alpha.10
