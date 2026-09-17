import type { ComposerModeOption } from '@/ds/components/Composer';
import type { ModelPickerOption, ModelPickerPack } from '@/ds/components/ModelPicker';

export const models: ModelPickerOption[] = [
  { id: 'openai/gpt-4.1', provider: 'openai', modelName: 'GPT-4.1' },
  { id: 'openai/gpt-4.1-mini', provider: 'openai', modelName: 'GPT-4.1 Mini' },
  { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'Claude Sonnet 4.5' },
];
export const modes: ComposerModeOption[] = [
  { id: 'build', name: 'Build', tone: 'green' },
  { id: 'plan', name: 'Plan', tone: 'purple' },
  { id: 'fast', name: 'Fast', tone: 'orange' },
];
export const packs: ModelPickerPack[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    summary: 'GPT-4.1 · GPT-4.1 · GPT-4.1 Mini',
    detail: 'Build openai/gpt-4.1 · Plan openai/gpt-4.1 · Fast openai/gpt-4.1-mini',
    keywords: ['Balanced', 'openai/gpt-4.1', 'openai/gpt-4.1-mini'],
  },
  {
    id: 'review',
    name: 'Review',
    summary: 'Claude Sonnet 4.5 · Claude Sonnet 4.5 · GPT-4.1 Mini',
    detail: 'Build anthropic/claude-sonnet-4-5 · Plan anthropic/claude-sonnet-4-5 · Fast openai/gpt-4.1-mini',
    keywords: ['Review', 'anthropic/claude-sonnet-4-5', 'openai/gpt-4.1-mini'],
  },
];
export function packModel(packId: string, modeId: string) {
  if (modeId === 'fast') return 'openai/gpt-4.1-mini';
  return packId === 'review' ? 'anthropic/claude-sonnet-4-5' : 'openai/gpt-4.1';
}
export type ModelControlState = 'ready' | 'loading' | 'unconfigured' | 'locked';
