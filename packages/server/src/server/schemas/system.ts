import { z } from 'zod/v4';

export const mastraPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export const agentBuilderConfigSchema = z.object({
  enabledSections: z.array(z.string()),
  marketplace: z.object({
    enabled: z.boolean(),
    showAgents: z.boolean(),
    showSkills: z.boolean(),
  }),
  configure: z.object({
    allowSkillCreation: z.boolean(),
    allowAppearance: z.boolean(),
  }),
  recents: z.object({
    maxItems: z.number(),
  }),
});

export const systemPackagesResponseSchema = z.object({
  packages: z.array(mastraPackageSchema),
  isDev: z.boolean(),
  cmsEnabled: z.boolean(),
  agentBuilderEnabled: z.boolean(),
  agentBuilderConfig: agentBuilderConfigSchema.nullable(),
  storageType: z.string().optional(),
  observabilityStorageType: z.string().optional(),
});

export type MastraPackage = z.infer<typeof mastraPackageSchema>;
export type AgentBuilderConfigResponse = z.infer<typeof agentBuilderConfigSchema>;
export type SystemPackagesResponse = z.infer<typeof systemPackagesResponseSchema>;
