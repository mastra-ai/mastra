import type { ProcessorProvider } from '@mastra/core/processor-provider';
import type { ProcessorGraphStep } from '@mastra/core/storage';

export function createProcessorFromStep(provider: ProcessorProvider, step: ProcessorGraphStep) {
  let config: Record<string, unknown>;
  try {
    config = provider.configSchema.parse(step.config) as Record<string, unknown>;
  } catch (error) {
    const details = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(
      `Invalid configuration for processor provider "${step.providerId}" in graph step "${step.id}"${details}`,
      { cause: error },
    );
  }

  return provider.createProcessor(config);
}
