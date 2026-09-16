# @mastra/auth-supabase

`@mastra/auth-supabase` verifies Supabase access tokens and exposes Supabase users to Mastra's authorization layer. Use it when Supabase Auth already manages your application users and you want the same sessions to protect Mastra endpoints.

## Installation

```bash
npm install @mastra/auth-supabase
```

## Usage

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` before starting Mastra.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthSupabase } from '@mastra/auth-supabase';

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthSupabase({
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
    }),
  },
});
```

## Documentation

- [Supabase integration guide](https://mastra.ai/integrations/auth/supabase)
- [Supabase provider reference](https://mastra.ai/reference/auth/supabase)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/supabase/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
