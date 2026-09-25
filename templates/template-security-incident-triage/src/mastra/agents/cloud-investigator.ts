import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import {
  InvestigatorOutputSchema,
  investigatorPrompt,
  UNTRUSTED_DATA_INSTRUCTIONS,
  type InvestigatorInvoker,
} from './investigator-output.js';
import { STRUCTURED_OUTPUT_MODEL_TIMEOUT } from './model-settings.js';

export function createCloudInvestigator(model: MastraModelConfig) {
  return new Agent({
    id: 'cloud-investigator',
    name: 'Cloud Investigator',
    description: 'Cites cloud facts for one trusted investigation scope.',
    instructions: `${UNTRUSTED_DATA_INSTRUCTIONS}\nValidate only the cloud fact tokens already read by the workflow.`,
    model,
    maxRetries: 0,
    tools: {},
    defaultOptions: {
      toolChoice: 'none',
      maxSteps: 3,
      maxProcessorRetries: 0,
      modelSettings: {
        temperature: 0,
        timeout: STRUCTURED_OUTPUT_MODEL_TIMEOUT,
      },
    },
  });
}

export const cloudInvestigator = createCloudInvestigator(process.env.MASTRA_MODEL ?? 'openai/gpt-4o-mini');

export const invokeCloudInvestigator: InvestigatorInvoker = async (input, _attempt, signal) =>
  (
    await cloudInvestigator.generate(investigatorPrompt(input), {
      structuredOutput: { schema: InvestigatorOutputSchema },
      toolChoice: 'none',
      maxSteps: 1,
      ...(signal ? { abortSignal: signal } : {}),
    })
  ).object;
