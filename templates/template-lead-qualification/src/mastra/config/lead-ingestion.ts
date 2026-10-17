import { z } from 'zod';

const sourceSchema = z.strictObject({
  id: z.string().min(1).max(100),
  inputProviderId: z.literal('generic'),
  destinationProviderId: z.string().min(1).max(100),
  crmProviderIds: z.array(z.string().min(1).max(100)).max(20),
});

export const intakeConfigSchema = z.strictObject({
  source: sourceSchema,
  limits: z.strictObject({
    maxBodyBytes: z.number().int().min(1024).max(262_144),
    maxPendingRuns: z.number().int().min(1).max(1000),
    activeRuns: z.number().int().min(1).max(2),
    dispatchIntervalMs: z.number().int().min(10).max(60_000),
  }),
});

export const intakeConfig = intakeConfigSchema.parse({
  source: {
    id: 'local-inbound',
    inputProviderId: 'generic',
    destinationProviderId: 'local',
    crmProviderIds: ['attio'],
  },
  limits: { maxBodyBytes: 262_144, maxPendingRuns: 100, activeRuns: 2, dispatchIntervalMs: 250 },
});

export type IntakeConfig = z.infer<typeof intakeConfigSchema>;
