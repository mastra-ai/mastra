# @mastra/slack

## 1.1.0-alpha.0

### Minor Changes

- Added @mastra/slack channel integration for connecting AI agents to Slack workspaces. Provides automatic Slack app provisioning via OAuth, manifest management with drift detection, encrypted credential storage, slash command support, and threaded conversation handling. Usage: ([#15876](https://github.com/mastra-ai/mastra/pull/15876))

  ```ts
  import { SlackProvider } from '@mastra/slack';

  const mastra = new Mastra({
    channels: {
      slack: new SlackProvider({
        refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN!,
      }),
    },
  });

  // Connect an agent to Slack
  const result = await mastra.channels.slack.connect('my-agent');
  // result.type === 'oauth' → redirect user to result.authorizationUrl
  ```

### Patch Changes

- Updated dependencies [[`b2deb29`](https://github.com/mastra-ai/mastra/commit/b2deb29412b300c868655b5840463614fbb7962d), [`66644be`](https://github.com/mastra-ai/mastra/commit/66644beac1aa560f0e417956ff007c89341dc382), [`310b953`](https://github.com/mastra-ai/mastra/commit/310b95345f302dcd5ba3ed862bdc96f059d44122), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`da0b9e2`](https://github.com/mastra-ai/mastra/commit/da0b9e2ba7ecc560213b426d6c097fe63946086e)]:
  - @mastra/core@1.31.0-alpha.3
