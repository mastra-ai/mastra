import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { Hono } from 'hono';

import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { fakeRouteAuth, mountApiRoutes } from '../test-utils.js';
import { VoiceRoutes } from '../voice.js';
import type { VoiceRoutesDeps } from '../voice.js';

export function localAuthStorage(keys: Record<string, string>): AuthStorage {
  return { getStoredApiKey: (provider: string) => keys[provider] } as unknown as AuthStorage;
}

export async function mountVoiceRoutes(
  deps: Partial<Omit<VoiceRoutesDeps, 'auth'>> & { auth?: VoiceRoutesDeps['auth'] },
  user?: { org: string },
) {
  const seed = await createFactoryStorageForTests();
  const app = new Hono();
  if (user) {
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, { workosId: 'user-a', organizationId: user.org } as never);
      await next();
    });
  }
  mountApiRoutes(
    app as never,
    new VoiceRoutes({
      auth: deps.auth ?? fakeRouteAuth({ enabled: false }),
      voiceSettings: seed.voiceSettings,
      factoryProjects: seed.projects,
      ...deps,
    }).routes(),
  );
  return app;
}
