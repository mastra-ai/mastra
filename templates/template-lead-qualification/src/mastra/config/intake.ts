import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

const sourceSchema = z.strictObject({
  id: z.string().min(1).max(100),
  inputProviderId: z.literal('generic'),
  destinationProviderId: z.string().min(1).max(100),
  crmProviderIds: z.array(z.string().min(1).max(100)).max(20),
});

export const intakeConfigSchema = z.strictObject({
  source: sourceSchema,
  limits: z.strictObject({
    maxBodyBytes: z.number().int().min(1024).max(262_144),
    maxPendingRuns: z.number().int().min(1).max(1000),
    activeRuns: z.number().int().min(1).max(2),
    dispatchIntervalMs: z.number().int().min(10).max(60_000),
  }),
});

export const intakeConfig = intakeConfigSchema.parse({
  source: {
    id: 'local-inbound',
    inputProviderId: 'generic',
    destinationProviderId: 'local',
    crmProviderIds: ['attio'],
  },
  limits: { maxBodyBytes: 262_144, maxPendingRuns: 100, activeRuns: 2, dispatchIntervalMs: 250 },
});

const environmentSchema = z
  .strictObject({
    mode: z.enum(['local', 'production']),
    token: z.string().optional(),
  })
  .refine(value => value.mode !== 'production' || (value.token?.length ?? 0) >= 32, {
    message: 'Production requires LEAD_QUALIFICATION_TOKEN with at least 32 characters',
    path: ['token'],
  });

export function runtimeConfig(environment: NodeJS.ProcessEnv = process.env) {
  const config = environmentSchema.parse({
    mode: environment.LEAD_QUALIFICATION_MODE ?? 'local',
    token: environment.LEAD_QUALIFICATION_TOKEN || undefined,
  });
  // CLI modes use different generated working directories. Resolve their trusted hint
  // to the enclosing project, keeping both databases outside disposable build output.
  let projectRoot = resolve(environment.MASTRA_PROJECT_ROOT ?? process.cwd());
  while (!existsSync(resolve(projectRoot, 'package.json'))) {
    const parent = dirname(projectRoot);
    if (parent === projectRoot) throw new Error('Cannot locate the application project directory');
    projectRoot = parent;
  }
  return {
    ...config,
    host: config.mode === 'local' ? '127.0.0.1' : '0.0.0.0',
    applicationPath: resolve(projectRoot, 'data/application.db'),
    observabilityPath: resolve(projectRoot, 'data/observability.duckdb'),
  };
}
export type IntakeConfig = z.infer<typeof intakeConfigSchema>;
export type RuntimeConfig = ReturnType<typeof runtimeConfig>;
