import { z } from 'zod';

import type { JsonSchema } from '@/lib/json-schema';

export const promptBlockFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less'),
  content: z.string(),
  rules: z.any().optional(),
  variables: z.custom<JsonSchema>().optional(),
});

export type PromptBlockFormValues = z.infer<typeof promptBlockFormSchema>;
