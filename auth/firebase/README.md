# @mastra/auth-firebase

`@mastra/auth-firebase` verifies Firebase ID tokens and can use Firestore data for authorization decisions. Use it when Firebase Authentication already manages your users and Mastra endpoints should honor those identities.

## Installation

```bash
npm install @mastra/auth-firebase
```

## Usage

Set `FIREBASE_SERVICE_ACCOUNT` and, when needed, `FIRESTORE_DATABASE_ID`.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthFirebase } from '@mastra/auth-firebase';

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthFirebase(),
  },
});
```

## Documentation

- [Firebase integration guide](https://mastra.ai/integrations/auth/firebase)
- [Firebase provider reference](https://mastra.ai/reference/auth/firebase)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/firebase/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
