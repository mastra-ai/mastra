import { z } from 'zod';

export const modelSetupPresetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('company'), allowPersonal: z.boolean() }),
  z.object({ kind: z.literal('individual') }),
]);
export type ModelSetupPreset = z.infer<typeof modelSetupPresetSchema>;
export type SaveModelSetupPreset = (factoryId: string, preset: ModelSetupPreset) => Promise<void>;
export const DEFAULT_MODEL_PRESET: ModelSetupPreset = { kind: 'company', allowPersonal: false };

export function allowsPersonalSetup(preset: ModelSetupPreset): boolean {
  return preset.kind === 'individual' || preset.allowPersonal;
}

export function modelSetupLabel(preset: ModelSetupPreset): string {
  if (preset.kind === 'individual') return 'Everyone brings their own';
  return preset.allowPersonal ? 'Company + personal accounts' : 'Company account';
}
