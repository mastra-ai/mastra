import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

const environmentSchema = z
  .strictObject({
    mode: z.enum(['local', 'production']),
    token: z.string().optional(),
  })
  .refine(value => value.mode !== 'production' || (value.token?.length ?? 0) >= 32, {
    message: 'Production requires LEAD_QUALIFICATION_TOKEN with at least 32 characters',
    path: ['token'],
  });

export const runtimeSettingsSchema = environmentSchema.safeExtend({
  host: z.string().min(1),
  applicationPath: z.string().min(1),
  observabilityPath: z.string().min(1),
});

export function resolveProjectRoot(environment: NodeJS.ProcessEnv = process.env) {
  // CLI modes use different generated working directories. Resolve their trusted hint
  // to the enclosing project, keeping both databases outside disposable build output.
  let projectRoot = resolve(environment.MASTRA_PROJECT_ROOT ?? process.cwd());
  while (!existsSync(resolve(projectRoot, 'package.json'))) {
    const parent = dirname(projectRoot);
    if (parent === projectRoot) throw new Error('Cannot locate the application project directory');
    projectRoot = parent;
  }
  return projectRoot;
}

export function runtimeConfig(environment: NodeJS.ProcessEnv = process.env) {
  const config = environmentSchema.parse({
    mode: environment.LEAD_QUALIFICATION_MODE ?? 'local',
    token: environment.LEAD_QUALIFICATION_TOKEN || undefined,
  });
  const projectRoot = resolveProjectRoot(environment);
  return {
    ...config,
    host: config.mode === 'local' ? '127.0.0.1' : '0.0.0.0',
    applicationPath: resolve(projectRoot, 'data/application.db'),
    observabilityPath: resolve(projectRoot, 'data/observability.duckdb'),
  };
}
export type RuntimeConfig = ReturnType<typeof runtimeConfig>;
