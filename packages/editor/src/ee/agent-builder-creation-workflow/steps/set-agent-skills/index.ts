import { createStep } from '@mastra/core/workflows';

import { resolveAvailableSkills } from '../../available';
import { configSchema, type Config, type StepFactoryArgs } from '../../types';
import { createSkillsAgent } from './agent';
import { resolveSkills } from './handler';

/**
 * Resolve the agent's skills. No-ops when the `skills` capability isn't enabled
 * for the builder. Otherwise reads the registered Mastra editor to enumerate the
 * available stored skills, then injects the scoped skills agent into the handler
 * so it selects the minimum relevant set. Also no-ops when none are available.
 */
export const createSetSkillsStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-skills',
    description: 'Set the agent skills',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, mastra }) => {
      const config = inputData as Config;
      // Skip entirely when the `skills` capability isn't enabled for the builder.
      if (!config.featureCapabilities?.skills) return config;

      const availableSkills = await resolveAvailableSkills(mastra);
      if (availableSkills.length === 0) return config;

      const agent = createSkillsAgent({ model });
      const skills = await resolveSkills(agent, availableSkills);

      return { ...config, skills };
    },
  });
