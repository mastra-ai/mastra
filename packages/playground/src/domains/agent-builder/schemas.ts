import { z } from 'zod';

export const AgentBuilderEditFormSchema = z.object({
  name: z.string(),
});

export type AgentBuilderEditFormValues = z.infer<typeof AgentBuilderEditFormSchema>;
