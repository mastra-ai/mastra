import { z } from 'zod';
import { resolve } from 'node:path';

import { JEV_ACCESS } from './jev-config';
import { MODEL_DEFAULTS } from './model-defaults-config';
import {
  OVERRIDE_BOUNDS,
  resolveDatabaseUrl,
  resolveStorageRoot,
  SERVER_DEFAULTS,
  STORAGE_DEFAULTS,
} from './runtime-config';
import { SOURCE_LIMITS } from './source-config';

export * from './jev-config';
export * from './model-defaults-config';
export * from './policy-config';
export * from './runtime-config';
export * from './source-config';

function numericEnvironmentValue(fallback: number, min: number, max: number, integer = false) {
  let value = z.number().min(min).max(max);
  if (integer) value = value.int();

  return z.preprocess(raw => {
    if (raw === undefined) return fallback;
    // Reject blank strings instead of letting JavaScript convert them to zero.
    if (typeof raw !== 'string' || raw.trim() === '') return Number.NaN;
    return Number(raw);
  }, value);
}

const environmentSchema = z
  .object({
    EXECUTION_MODE: z.enum(['local', 'production']).default(SERVER_DEFAULTS.executionMode),
    ENABLE_MONITOR_SCHEDULER: z.enum(['true', 'false']).default('false'),
    MASTRA_API_TOKEN: z.string().optional(),
    MAX_SOURCES: numericEnvironmentValue(
      SOURCE_LIMITS.defaultMaxSources,
      OVERRIDE_BOUNDS.minCount,
      SOURCE_LIMITS.maxSources,
      true,
    ),
    SOURCE_CONCURRENCY: numericEnvironmentValue(
      SOURCE_LIMITS.defaultConcurrency,
      OVERRIDE_BOUNDS.minCount,
      SOURCE_LIMITS.maxConcurrency,
      true,
    ),
    CANDIDATES_PER_SOURCE: numericEnvironmentValue(
      SOURCE_LIMITS.defaultCandidatesPerSource,
      OVERRIDE_BOUNDS.minCount,
      SOURCE_LIMITS.maxCandidatesPerSource,
      true,
    ),
    JEV_MODEL: z.string().trim().min(1).default(MODEL_DEFAULTS.jev),
    JEV_ACCESS_MODE: z.enum([JEV_ACCESS.direct, JEV_ACCESS.vercelGateway]).default(JEV_ACCESS.direct),
    TYPESAFE_AI_API_KEY: z.string().trim().min(1).optional(),
    AI_GATEWAY_API_KEY: z.string().trim().min(1).optional(),
    OPENAI_API_KEY: z.string().trim().min(1).optional(),
    MASTRA_DATABASE_URL: z.string().trim().min(1).default(STORAGE_DEFAULTS.mastraUrl),
    MONITOR_DATABASE_URL: z.string().trim().min(1).default(STORAGE_DEFAULTS.monitorUrl),
    MASTRA_PROJECT_ROOT: z.string().trim().min(1).optional(),
  })
  .superRefine((env, context) => {
    const token = env.MASTRA_API_TOKEN;
    if (env.EXECUTION_MODE === 'production' && !token?.trim()) {
      context.addIssue({ code: 'custom', path: ['MASTRA_API_TOKEN'], message: 'Required in production' });
    } else if (token?.trim() && /\s/.test(token)) {
      context.addIssue({ code: 'custom', path: ['MASTRA_API_TOKEN'], message: 'Token must not contain whitespace' });
    }
    if (
      env.JEV_ACCESS_MODE === JEV_ACCESS.vercelGateway &&
      !([MODEL_DEFAULTS.jev, JEV_ACCESS.vercelGatewayModel] as string[]).includes(env.JEV_MODEL)
    ) {
      context.addIssue({ code: 'custom', path: ['JEV_MODEL'], message: 'Gateway model is fixed' });
    }
  });

/** Call once at startup. Importing constants neither reads credentials nor starts services. */
export function loadConfig(environment: Readonly<Record<string, string | undefined>> = process.env) {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    // Report only variable names. Zod inputs and supplied credential values must stay private.
    const variables = [...new Set(result.error.issues.map(issue => issue.path.join('.')))];
    throw new Error(`Invalid configuration: ${variables.join(', ')}`);
  }

  const env = result.data;
  const gateway = env.JEV_ACCESS_MODE === JEV_ACCESS.vercelGateway;
  const jevModel = gateway ? JEV_ACCESS.vercelGatewayModel : env.JEV_MODEL;
  const projectRoot = resolveStorageRoot(environment, env.MASTRA_PROJECT_ROOT);
  return {
    executionMode: env.EXECUTION_MODE,
    schedule: {
      enabled: env.ENABLE_MONITOR_SCHEDULER === 'true',
      file: resolve(projectRoot, 'scheduled-monitors.json'),
    },
    // Never log or persist this object: it contains the server credential.
    server: {
      host: env.EXECUTION_MODE === 'local' ? SERVER_DEFAULTS.localHost : SERVER_DEFAULTS.productionHost,
      apiToken: env.EXECUTION_MODE === 'production' ? env.MASTRA_API_TOKEN : undefined,
    },
    sources: {
      maxSources: env.MAX_SOURCES,
      concurrency: env.SOURCE_CONCURRENCY,
      candidatesPerSource: env.CANDIDATES_PER_SOURCE,
    },
    models: { ...MODEL_DEFAULTS, jev: jevModel },
    jev: {
      accessMode: env.JEV_ACCESS_MODE,
      baseURL: gateway ? JEV_ACCESS.vercelGatewayBaseUrl : undefined,
    },
    credentials: {
      jevApiKey: gateway ? env.AI_GATEWAY_API_KEY : env.TYPESAFE_AI_API_KEY,
      openaiApiKey: env.OPENAI_API_KEY,
    },
    storage: {
      mastraUrl: resolveDatabaseUrl(env.MASTRA_DATABASE_URL, projectRoot),
      monitorUrl: resolveDatabaseUrl(env.MONITOR_DATABASE_URL, projectRoot),
      reportsDir: resolve(projectRoot, '.data/reports'),
    },
  };
}

export type MonitorConfig = ReturnType<typeof loadConfig>;
