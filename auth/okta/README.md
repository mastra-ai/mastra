# @mastra/auth-okta

`@mastra/auth-okta` integrates Okta authentication and group-based role mapping with Mastra. Use it when Okta is your identity provider or when Okta groups should control access to Mastra agents, workflows, and other resources.

## Installation

```bash
npm install @mastra/auth-okta
```

## Usage

Set `OKTA_DOMAIN`, `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`, `OKTA_REDIRECT_URI`, and `OKTA_COOKIE_PASSWORD` before starting Mastra.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthOkta } from '@mastra/auth-okta';

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthOkta(),
  },
});
```

## Documentation

- [Okta integration guide](https://mastra.ai/integrations/auth/okta)
- [Okta provider reference](https://mastra.ai/reference/auth/okta)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/okta/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
