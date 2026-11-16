import { SimpleAuth } from '@mastra/core/server';
import type { Config } from '@mastra/core/mastra';
import type { IntakeConfig } from './lead-ingestion';
import type { RuntimeConfig } from './runtime';

export function createServerConfig(runtime: RuntimeConfig, limits: IntakeConfig['limits']) {
  const auth =
    runtime.mode === 'production'
      ? new SimpleAuth({
          tokens: { [runtime.token!]: { id: 'lead-operator' } },
          headers: ['Authorization'],
          // Background dispatch and Studio share the same operator resource.
          mapUserToResourceId: () => 'lead-qualification',
        })
      : undefined;
  return {
    // Studio headers must never select a less restrictive authentication policy.
    studio: { auth },
    server: {
      host: runtime.host,
      port: runtime.port ?? 4111,
      auth,
      cors: false,
      bodySizeLimit: limits.maxBodyBytes,
      drainTimeout: 5000,
      build: { apiReqLogs: false },
      onError: () =>
        new Response(JSON.stringify({ error: 'request_failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
    },
  } satisfies Pick<Config, 'server' | 'studio'>;
}
