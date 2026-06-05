import { createStep } from '@mastra/core/workflows';

import { createSkillsAgent } from '../agents';
import { resolveSkills } from '../handlers';
import { configSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../types';

/**
 * Resolve the attached `skills`. Instantiates the scoped skills agent from the
 * builder `model` and injects it into the handler (DI).
 */
export const createSetSkillsStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-skills',
    description: 'Set the agent skills',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, getInitData }) => {
      const init = getInitData<WorkflowInput>();
      const config = inputData as Config;
      if (!init.skills) {
        return config;
      }
      const agent = createSkillsAgent({ model });
      return { ...config, skills: await resolveSkills(agent, init.skills) };
    },
  });
