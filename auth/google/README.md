# @mastra/auth-google

Mastra Google Workspace Auth integration. Install `@mastra/auth-google` to use it in your Mastra application.

## Installation

```bash
npm install @mastra/auth-google
```

## Usage

Set `GOOGLE_CLIENT_ID` or pass a client ID explicitly.

```typescript
import { MastraAuthGoogle } from '@mastra/auth-google';

const auth = new MastraAuthGoogle({ clientId: process.env.GOOGLE_CLIENT_ID! });
```

## Documentation

- [@mastra/auth-google documentation](https://mastra.ai/reference/auth/google)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/google/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
