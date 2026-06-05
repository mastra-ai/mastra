import { createStep } from '@mastra/core/workflows';

import { resolveSkills } from '../handlers';
import { configSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../types';

/**
 * Resolve attached `skills` into a `Record<id, true>`. Takes the builder `model`
 * for future LLM-backed skill selection.
 */
export const createSetSkillsStep = ({ model }: StepFactoryArgs) => {
  void model;
  return createStep({
    id: 'set-agent-skills',
    description: 'Set the agent skills',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, getInitData }) => {
      const init = getInitData<WorkflowInput>();
      const config = inputData as Config;
      return { ...config, skills: init.skills ? resolveSkills(init.skills) : undefined };
    },
  });
};
