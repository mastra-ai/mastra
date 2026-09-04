import { describe, expect, it, vi } from 'vitest';
import type { MappingStepEntry } from '../types';
import { runMappingEntry } from './run-mapping-entry';
import type { EntryExecuteContext } from './types';

const falsyOutputs: Array<{
  name: string;
  output: Record<string, never> | 0 | false | '';
}> = [
  { name: 'an empty object', output: {} },
  { name: 'zero', output: 0 },
  { name: 'false', output: false },
  { name: 'an empty string', output: '' },
];

describe('runMappingEntry', () => {
  it.each(falsyOutputs)('preserves $name from the successful step in an array', async ({ output }) => {
    const skippedStep = { id: 'skipped-step' };
    const successfulStep = { id: 'successful-step' };
    const getStepResult = vi.fn((step: { id: string }) => (step === successfulStep ? output : null));
    const entry = {
      type: 'mapping',
      id: 'mapping-step',
      mapConfig: {
        picked: { step: [skippedStep, successfulStep], path: '.' },
      },
    } as unknown as MappingStepEntry;
    const ctx = {
      getStepResult,
      getInitData: vi.fn(),
      requestContext: { get: vi.fn() },
    } as unknown as EntryExecuteContext;

    await expect(runMappingEntry(entry, ctx)).resolves.toEqual({ picked: output });
    expect(getStepResult).toHaveBeenCalledWith(successfulStep);
  });
});
