# @mastra/auth-google

`@mastra/auth-google` authenticates Google Workspace users and supports authorization based on hosted domains and Workspace identity. Use it when employees should sign in to Mastra with their existing Google organization accounts.

## Installation

```bash
npm install @mastra/auth-google
```

## Usage

Set `GOOGLE_CLIENT_ID` before starting Mastra.

```typescript
import { MastraAuthGoogle } from '@mastra/auth-google';
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthGoogle({
      clientId: process.env.GOOGLE_CLIENT_ID,
      allowedDomains: ['example.com'],
    }),
  },
});
```

## Documentation

- [Google authentication guide](https://mastra.ai/integrations/auth/google)
- [Google provider reference](https://mastra.ai/reference/auth/google)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/google/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
