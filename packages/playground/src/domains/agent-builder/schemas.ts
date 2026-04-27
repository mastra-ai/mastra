import { z } from 'zod';

export const AgentBuilderEditFormSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  instructions: z.string(),
  tools: z.record(z.string(), z.boolean()).optional(),
  agents: z.record(z.string(), z.boolean()).optional(),
  skills: z.array(z.string()).optional(),
  workspaceId: z.string().optional(),
});

export type AgentBuilderEditFormValues = z.infer<typeof AgentBuilderEditFormSchema>;
