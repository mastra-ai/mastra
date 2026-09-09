import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createProcessorFromStep } from './processor-provider-config';

function createProvider(configSchema: z.ZodType) {
  return {
    configSchema,
    createProcessor: vi.fn((config: Record<string, unknown>) => ({ id: 'processor', config })),
  };
}

describe('createProcessorFromStep', () => {
  it('passes parsed defaults and transforms to the processor factory', () => {
    const provider = createProvider(
      z.object({
        label: z.string().trim(),
        retries: z.number().default(2),
      }),
    );

    const processor = createProcessorFromStep(provider as never, {
      id: 'normalizer-step',
      providerId: 'normalizer',
      config: { label: ' input ' },
      enabledPhases: ['processInput'],
    });

    expect(provider.createProcessor).toHaveBeenCalledWith({ label: 'input', retries: 2 });
    expect(processor).toEqual({ id: 'processor', config: { label: 'input', retries: 2 } });
  });

  it('rejects invalid config before calling the processor factory', () => {
    const provider = createProvider(z.object({ threshold: z.number().min(0).max(1) }));

    expect(() =>
      createProcessorFromStep(provider as never, {
        id: 'strict-step',
        providerId: 'strict-provider',
        config: { threshold: 'high' },
        enabledPhases: ['processInput'],
      }),
    ).toThrow('Invalid configuration for processor provider "strict-provider" in graph step "strict-step"');
    expect(provider.createProcessor).not.toHaveBeenCalled();
  });

  it('does not relabel processor factory errors as config validation failures', () => {
    const provider = createProvider(z.object({}));
    const factoryError = new Error('Processor initialization failed');
    provider.createProcessor.mockImplementation(() => {
      throw factoryError;
    });

    expect(() =>
      createProcessorFromStep(provider as never, {
        id: 'factory-step',
        providerId: 'factory-provider',
        config: {},
        enabledPhases: ['processInput'],
      }),
    ).toThrow(factoryError);
  });
});
