import { z } from 'zod';

// This is an onboarding checklist, never a credential-routing or authorization policy.
const setupSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('company'), setupPersonal: z.boolean() }),
  z.object({ kind: z.literal('individual') }),
]);
// Resume older preview drafts without losing repository/model choices.
export const modelSetupPresetSchema = z.union([
  setupSchema,
  z
    .object({ kind: z.literal('company'), allowPersonal: z.boolean() })
    .transform(({ kind, allowPersonal }) => ({ kind, setupPersonal: allowPersonal })),
]);

export type ModelSetupPreset = z.infer<typeof modelSetupPresetSchema>;
export type SaveModelSetupPreset = (factoryId: string, preset: ModelSetupPreset) => Promise<void>;
export const DEFAULT_MODEL_PRESET: ModelSetupPreset = { kind: 'company', setupPersonal: false };

export function includesPersonalSetup(preset: ModelSetupPreset): boolean {
  return preset.kind === 'individual' || preset.setupPersonal;
}

export function modelSetupLabel(preset: ModelSetupPreset): string {
  if (preset.kind === 'individual') return 'My account';
  return preset.setupPersonal ? 'Company + my account' : 'Company account';
}
