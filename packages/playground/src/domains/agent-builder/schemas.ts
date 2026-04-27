import { z } from 'zod';

const skillConfigSchema = z.object({
  description: z.string().optional(),
  instructions: z.string().optional(),
  pin: z.string().optional(),
  strategy: z.enum(['latest', 'live']).optional(),
});

export const AgentBuilderEditFormSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  instructions: z.string(),
  tools: z.record(z.string(), z.boolean()).optional(),
  agents: z.record(z.string(), z.boolean()).optional(),
  workflows: z.record(z.string(), z.boolean()).optional(),
  skills: z.record(z.string(), skillConfigSchema).optional(),
  workspaceId: z.string().optional(),
});

export type AgentBuilderEditFormValues = z.infer<typeof AgentBuilderEditFormSchema>;
export type AgentBuilderSkillConfig = z.infer<typeof skillConfigSchema>;
