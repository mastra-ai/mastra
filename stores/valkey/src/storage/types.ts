import type { GlideClient, GlideClientConfiguration } from '@valkey/valkey-glide';

import type { ValkeyClient } from '../client';

export type { ValkeyClient } from '../client';

export type ValkeyConfig = {
  id: string;
  disableInit?: boolean;
} & (
  | {
      /** A pre-configured GLIDE standalone client. The caller owns its lifecycle. */
      client: GlideClient;
    }
  | {
      /** Native GLIDE standalone client configuration. */
      config: GlideClientConfiguration;
    }
  | {
      host: string;
      port?: number;
      username?: string;
      password?: string;
      db?: number;
      useTLS?: boolean;
    }
);

export type ResolvedValkeyClient = ValkeyClient;
