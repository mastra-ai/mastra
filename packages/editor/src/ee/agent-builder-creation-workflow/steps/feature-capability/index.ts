import { createStep } from '@mastra/core/workflows';

import { resolveFeatureCapabilities } from '../../available';
import { configSchema, type Config, type StepFactoryArgs } from '../../types';

/**
 * Resolve which agent-builder capabilities are enabled for the running builder
 * and seed the config-in-progress with them. Reads the registered Mastra builder
 * feature flags deterministically (no agent), mirroring the playground's
 * `useBuilderAgentFeatures`. Runs right after `understand-user-outcome` so later
 * steps can gate on the resolved capabilities.
 */
export const createFeatureCapabilityStep = ({ model }: StepFactoryArgs) => {
  void model;
  return createStep({
    id: 'feature-capability',
    description: 'Resolve which agent-builder capabilities are enabled',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, mastra }) => {
      const config = inputData as Config;
      const featureCapabilities = await resolveFeatureCapabilities(mastra);
      return { ...config, featureCapabilities };
    },
  });
};
