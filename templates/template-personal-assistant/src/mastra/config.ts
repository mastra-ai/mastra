import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';

export const explicitTimezone = z
  .string()
  .trim()
  .min(1)
  .refine(value => {
    try {
      if (/^[+-]/.test(value)) return false;
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Provide an explicit IANA timezone.');

const modelId = z
  .string()
  .trim()
  .regex(/^(?:openai\/[a-zA-Z0-9][a-zA-Z0-9._:-]*|mastra\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9][a-zA-Z0-9._:-]*)$/);
const configuration = z.object({
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  AGENT_MODEL: modelId.optional(),
  ASSISTANT_OWNER_ID: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/)
    .default('local-owner'),
  ASSISTANT_MODEL: modelId.default('openai/gpt-6-luna'),
  ASSISTANT_JUDGE_MODEL: modelId.optional(),
  ASSISTANT_MAX_GOAL_EVALUATIONS: z.coerce.number().int().min(1).max(20).default(5),
  ASSISTANT_MAX_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).max(10000).default(240),
  ASSISTANT_MAX_CONCURRENT_MODELS: z.coerce.number().int().min(1).max(16).default(2),
  ASSISTANT_MAX_MODEL_CALLS_PER_HOUR: z.coerce.number().int().min(1).max(10000).default(120),
  ASSISTANT_MAX_MODEL_TOKENS_PER_HOUR: z.coerce.number().int().min(1).max(100000000).default(10000000),
  ASSISTANT_MAX_SCHEDULES: z.coerce.number().int().min(1).max(100).default(10),
  ASSISTANT_MAX_STEPS: z.coerce.number().int().min(1).max(20).default(20),
  ASSISTANT_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1).max(32768).optional(),
  ASSISTANT_MODEL_MAX_RETRIES: z.coerce.number().int().min(0).max(5).optional(),
  ASSISTANT_TIMEZONE: explicitTimezone.optional(),
  ASSISTANT_DATA_DIR: z.string().trim().min(1).optional(),
  ASSISTANT_RUNTIME: z.enum(['local', 'hosted']).default('local'),
  TURSO_DATABASE_URL: z.string().optional(),
  TURSO_AUTH_TOKEN: z.string().trim().min(1).optional(),
  ASSISTANT_API_TOKEN: z.string().trim().min(32).optional(),
  MASTRA_PLATFORM_STUDIO_AUTH: z.string().optional(),
  ASSISTANT_PLATFORM_TRACING: z.enum(['true', 'false']).default('false'),
  MASTRA_PROJECT_ID: z.string().trim().min(1).optional(),
  MASTRA_PLATFORM_ACCESS_TOKEN: z.string().trim().min(1).optional(),
  MASTRA_PLATFORM_SECRET_KEY: z.string().trim().min(1).optional(),
  ASSISTANT_CONNECT_PROVIDERS: z
    .string()
    .transform((value, ctx) => {
      try {
        return z
          .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
          .max(32)
          .parse(JSON.parse(value));
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Use a JSON array of provider IDs.' });
        return z.NEVER;
      }
    })
    .default(['google-mail', 'google-docs', 'notion', 'jira']),
  ASSISTANT_CONNECT_TOOLS: z
    .string()
    .transform((value, ctx) => {
      try {
        return z
          .array(z.string().regex(/^[a-zA-Z0-9_.:-]+$/))
          .max(512)
          .parse(JSON.parse(value));
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Use a JSON array of exact tool keys.' });
        return z.NEVER;
      }
    })
    .optional(),
});

/** Validate runtime settings without returning model or Connect credentials. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const settings = { ...env };
  if (!settings.AGENT_MODEL?.trim()) delete settings.AGENT_MODEL;
  if (!settings.OPENAI_API_KEY?.trim()) delete settings.OPENAI_API_KEY;
  for (const name of ['MASTRA_PROJECT_ID', 'MASTRA_PLATFORM_ACCESS_TOKEN', 'MASTRA_PLATFORM_SECRET_KEY']) {
    if (settings[name] === '') delete settings[name];
  }
  const platform = ['MASTRA_DEPLOYMENT_ID', 'MASTRA_CLOUD_API_ENDPOINT', 'MASTRA_PLATFORM_PROJECT_ID'].some(name =>
    Boolean(settings[name]),
  );
  if (platform && settings.ASSISTANT_RUNTIME !== 'hosted') {
    throw new Error('Invalid assistant configuration: Platform requires ASSISTANT_RUNTIME=hosted.');
  }
  const result = configuration.safeParse(settings);
  if (!result.success) {
    const settings = [...new Set(result.error.issues.map(issue => issue.path[0]))].join(', ');
    throw new Error(`Invalid assistant configuration: check ${settings}.`);
  }
  const value = result.data;
  const model = value.AGENT_MODEL ?? value.ASSISTANT_MODEL;
  const judgeModel = value.ASSISTANT_JUDGE_MODEL ?? model;
  if ([model, judgeModel].some(id => id.startsWith('openai/')) && !value.OPENAI_API_KEY)
    throw new Error('Invalid assistant configuration: check OPENAI_API_KEY.');
  const token = value.MASTRA_PLATFORM_ACCESS_TOKEN || value.MASTRA_PLATFORM_SECRET_KEY;
  if (Boolean(value.MASTRA_PROJECT_ID) !== Boolean(token)) {
    throw new Error(
      'Invalid assistant configuration: set MASTRA_PROJECT_ID and MASTRA_PLATFORM_ACCESS_TOKEN (or MASTRA_PLATFORM_SECRET_KEY) together.',
    );
  }
  const runtimeSettings = z
    .discriminatedUnion('ASSISTANT_RUNTIME', [
      z.object({
        ASSISTANT_RUNTIME: z.literal('local'),
        TURSO_DATABASE_URL: z.never().optional(),
        TURSO_AUTH_TOKEN: z.never().optional(),
        ASSISTANT_API_TOKEN: z.string().trim().min(32).optional(),
        ASSISTANT_PLATFORM_TRACING: z.literal('false'),
      }),
      z.object({
        ASSISTANT_RUNTIME: z.literal('hosted'),
        TURSO_DATABASE_URL: z.string().transform((input, context) => {
          try {
            const url = new URL(input);
            if (
              !['libsql:', 'https:'].includes(url.protocol) ||
              !url.hostname.endsWith('.turso.io') ||
              url.username ||
              url.password ||
              url.port ||
              !['', '/'].includes(url.pathname) ||
              url.search ||
              url.hash
            )
              throw new Error();
            return url.toString();
          } catch {
            context.addIssue({ code: 'custom', message: 'Use a secure remote Turso database URL.' });
            return z.NEVER;
          }
        }),
        TURSO_AUTH_TOKEN: z.string().trim().min(1),
        ASSISTANT_API_TOKEN: z.string().trim().min(32),
        MASTRA_PLATFORM_STUDIO_AUTH: z.literal('disabled'),
      }),
    ])
    .safeParse(value);
  if (!runtimeSettings.success) {
    const names = [...new Set(runtimeSettings.error.issues.map(issue => issue.path[0]))].join(', ');
    throw new Error(
      `Invalid assistant configuration: check ASSISTANT_RUNTIME and ${names}. Hosted operation requires secure Turso storage, an owner token of at least 32 characters, and MASTRA_PLATFORM_STUDIO_AUTH=disabled.`,
    );
  }
  const runtimeValue = runtimeSettings.data;
  const runtime =
    runtimeValue.ASSISTANT_RUNTIME === 'local'
      ? {
          mode: 'local' as const,
          databasePath: resolve(value.ASSISTANT_DATA_DIR || '.data', 'assistant.db'),
          ownerToken: value.ASSISTANT_API_TOKEN ?? randomBytes(32).toString('hex'),
        }
      : {
          mode: 'hosted' as const,
          databaseUrl: runtimeValue.TURSO_DATABASE_URL,
          databaseToken: runtimeValue.TURSO_AUTH_TOKEN,
          ownerToken: runtimeValue.ASSISTANT_API_TOKEN,
        };
  if (
    value.ASSISTANT_PLATFORM_TRACING === 'true' &&
    (!value.MASTRA_PROJECT_ID || !value.MASTRA_PLATFORM_ACCESS_TOKEN)
  ) {
    throw new Error(
      'Invalid assistant configuration: ASSISTANT_PLATFORM_TRACING requires MASTRA_PROJECT_ID and MASTRA_PLATFORM_ACCESS_TOKEN.',
    );
  }
  return {
    runtime,
    platformTracing: value.ASSISTANT_PLATFORM_TRACING === 'true',
    ownerId: value.ASSISTANT_OWNER_ID,
    connect: value.MASTRA_PROJECT_ID
      ? {
          projectId: value.MASTRA_PROJECT_ID,
          providers: value.ASSISTANT_CONNECT_PROVIDERS,
          toolKeys: value.ASSISTANT_CONNECT_TOOLS,
        }
      : undefined,
    model: model as `openai/${string}` | `mastra/${string}/${string}`,
    maxSteps: value.ASSISTANT_MAX_STEPS,
    limits: {
      requestsPerMinute: value.ASSISTANT_MAX_REQUESTS_PER_MINUTE,
      concurrentModels: value.ASSISTANT_MAX_CONCURRENT_MODELS,
      modelCallsPerHour: value.ASSISTANT_MAX_MODEL_CALLS_PER_HOUR,
      modelTokensPerHour: value.ASSISTANT_MAX_MODEL_TOKENS_PER_HOUR,
      schedules: value.ASSISTANT_MAX_SCHEDULES,
    },
    modelSettings:
      value.ASSISTANT_MAX_OUTPUT_TOKENS === undefined
        ? undefined
        : { maxOutputTokens: value.ASSISTANT_MAX_OUTPUT_TOKENS },
    modelMaxRetries: value.ASSISTANT_MODEL_MAX_RETRIES,
    judgeModel: judgeModel as `openai/${string}` | `mastra/${string}/${string}`,
    maxGoalEvaluations: value.ASSISTANT_MAX_GOAL_EVALUATIONS,
    timezone: value.ASSISTANT_TIMEZONE,
  };
}

export type AssistantConfig = ReturnType<typeof loadConfig>;
