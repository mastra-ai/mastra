import { resolve } from 'node:path';
import { z } from 'zod';

const configuration = z.object({
  OPENAI_API_KEY: z.string().trim().min(1),
  ASSISTANT_OWNER_ID: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/)
    .default('local-owner'),
  ASSISTANT_MODEL: z
    .string()
    .regex(/^openai\/[a-zA-Z0-9][a-zA-Z0-9._:-]*$/)
    .default('openai/gpt-6-luna'),
  ASSISTANT_MAX_STEPS: z.coerce.number().int().min(1).max(20).default(20),
  ASSISTANT_TIMEZONE: z
    .string()
    .refine(value => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    })
    .optional(),
  ASSISTANT_DATA_DIR: z.string().trim().min(1).optional(),
  ASSISTANT_RUNTIME: z.literal('local').default('local'),
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

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const settings = { ...env };
  for (const name of ['MASTRA_PROJECT_ID', 'MASTRA_PLATFORM_ACCESS_TOKEN', 'MASTRA_PLATFORM_SECRET_KEY']) {
    if (settings[name] === '') delete settings[name];
  }
  const result = configuration.safeParse(settings);
  if (!result.success) {
    const settings = [...new Set(result.error.issues.map(issue => issue.path[0]))].join(', ');
    throw new Error(`Invalid assistant configuration: check ${settings}.`);
  }
  const value = result.data;
  const token = value.MASTRA_PLATFORM_ACCESS_TOKEN || value.MASTRA_PLATFORM_SECRET_KEY;
  if (Boolean(value.MASTRA_PROJECT_ID) !== Boolean(token)) {
    throw new Error(
      'Invalid assistant configuration: set MASTRA_PROJECT_ID and MASTRA_PLATFORM_ACCESS_TOKEN (or MASTRA_PLATFORM_SECRET_KEY) together.',
    );
  }
  return {
    ownerId: value.ASSISTANT_OWNER_ID,
    connect: value.MASTRA_PROJECT_ID
      ? {
          projectId: value.MASTRA_PROJECT_ID,
          providers: value.ASSISTANT_CONNECT_PROVIDERS,
          toolKeys: value.ASSISTANT_CONNECT_TOOLS,
        }
      : undefined,
    model: value.ASSISTANT_MODEL as `openai/${string}`,
    maxSteps: value.ASSISTANT_MAX_STEPS,
    timezone: value.ASSISTANT_TIMEZONE,
    databasePath: resolve(value.ASSISTANT_DATA_DIR || '.data', 'assistant.db'),
  };
}

export type AssistantConfig = ReturnType<typeof loadConfig>;
