import { z } from 'zod/v4';

// A stored null means explicitly cleared; an absent field still inherits defaults.
const clearable = <T extends z.ZodType>(schema: T) =>
  schema
    .nullable()
    .transform(value => value ?? undefined)
    .optional();

const modelSettingsSchema = z.object({
  frequencyPenalty: clearable(z.number()),
  presencePenalty: clearable(z.number()),
  maxRetries: clearable(z.number()),
  maxSteps: clearable(z.number()),
  maxTokens: clearable(z.number()),
  temperature: clearable(z.number()),
  topK: clearable(z.number()),
  topP: clearable(z.number()),
  seed: clearable(z.number()),
  providerOptions: clearable(z.record(z.string(), z.record(z.string(), z.json()))),
  chatWithGenerateLegacy: clearable(z.boolean()),
  chatWithGenerate: clearable(z.boolean()),
  chatWithLegacyStream: clearable(z.boolean()),
  chatWithNetwork: clearable(z.boolean()),
  requireToolApproval: clearable(z.boolean()),
});
const selectionSchema = z.object({ provider: z.string(), model: z.string() });
const recordSchema = z.record(z.string(), z.unknown());

export interface ThreadPreferences {
  selection?: z.infer<typeof selectionSchema>;
  modelSettings?: z.infer<typeof modelSettingsSchema>;
}

function readModelSettings(value: unknown): ThreadPreferences['modelSettings'] {
  const record = recordSchema.safeParse(value);
  if (!record.success) return undefined;

  const validFields: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(modelSettingsSchema.shape)) {
    if (!Object.hasOwn(record.data, key)) continue;
    const field = schema.safeParse(record.data[key]);
    if (field.success) validFields[key] = field.data;
  }
  return modelSettingsSchema.parse(validFields);
}

export const threadPreferencesSchema = recordSchema.transform((record): ThreadPreferences => {
  const selection = selectionSchema.safeParse(record.selection);
  return {
    selection: selection.success ? selection.data : undefined,
    modelSettings: readModelSettings(record.modelSettings),
  };
});

export function serializeThreadPreferences(preferences: ThreadPreferences): string {
  return JSON.stringify({
    ...preferences,
    modelSettings:
      preferences.modelSettings &&
      Object.fromEntries(
        Object.entries(preferences.modelSettings).map(([key, value]) => [key, value === undefined ? null : value]),
      ),
  });
}
