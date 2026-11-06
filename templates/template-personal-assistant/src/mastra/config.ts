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
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = configuration.safeParse(env);
  if (!result.success) {
    const settings = [...new Set(result.error.issues.map(issue => issue.path[0]))].join(', ');
    throw new Error(`Invalid assistant configuration: check ${settings}.`);
  }
  const value = result.data;
  return {
    ownerId: value.ASSISTANT_OWNER_ID,
    model: value.ASSISTANT_MODEL as `openai/${string}`,
    maxSteps: value.ASSISTANT_MAX_STEPS,
    timezone: value.ASSISTANT_TIMEZONE,
    databasePath: resolve(value.ASSISTANT_DATA_DIR || '.data', 'assistant.db'),
  };
}

export type AssistantConfig = ReturnType<typeof loadConfig>;
