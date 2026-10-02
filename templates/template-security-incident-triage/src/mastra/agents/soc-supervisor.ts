import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import { z } from 'zod';

import { InvestigationContextSchema, type InvestigationContext } from '../../evidence/contracts.js';

import { cloudInvestigator } from './cloud-investigator.js';
import { endpointInvestigator } from './endpoint-investigator.js';
import { identityInvestigator } from './identity-investigator.js';
import { UNTRUSTED_DATA_INSTRUCTIONS } from './investigator-output.js';
import { STRUCTURED_OUTPUT_MODEL_TIMEOUT } from './model-settings.js';

export function createSocSupervisor(
  model: MastraModelConfig,
  specialists: Readonly<{
    identityInvestigator: typeof identityInvestigator;
    endpointInvestigator: typeof endpointInvestigator;
    cloudInvestigator: typeof cloudInvestigator;
  }> = { identityInvestigator, endpointInvestigator, cloudInvestigator },
) {
  return new Agent({
    id: 'soc-supervisor',
    name: 'SOC Supervisor',
    description: 'Bounded coordinator for the three investigation specialists.',
    instructions: `${UNTRUSTED_DATA_INSTRUCTIONS}
Delegate once to the specialist fixed by the workflow for this invocation, then return its validated JSON unchanged.
The deterministic workflow owns scope, provider reads, parallel fan-out, persistence and ordering. You receive no authority identifiers. Do not add capabilities.`,
    model,
    maxRetries: 0,
    agents: specialists,
    tools: {},
    defaultOptions: {
      maxSteps: 4,
      maxProcessorRetries: 0,
      modelSettings: {
        temperature: 0,
        timeout: STRUCTURED_OUTPUT_MODEL_TIMEOUT,
      },
    },
  });
}

export const socSupervisor = createSocSupervisor(process.env.MASTRA_MODEL ?? 'openai/gpt-4o-mini');

const SupervisorSpecialistSchema = z.enum(['identity', 'endpoint', 'cloud']);
const expectedSpecialists = ['identity', 'endpoint', 'cloud'] as const;

export const SupervisorValidationSchema = z
  .object({
    scopeValidated: z.literal(true),
    // OpenAI structured output accepts one schema in `items`, not the
    // positional `prefixItems` emitted for a Zod tuple. Exact ordering remains
    // a deterministic validation concern below.
    specialists: z.array(SupervisorSpecialistSchema).length(3),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.specialists.some((specialist, index) => specialist !== expectedSpecialists[index])) {
      context.addIssue({
        code: 'custom',
        path: ['specialists'],
        message: 'Specialists must use the fixed investigation order.',
      });
    }
  });

export type SupervisorInvoker = (
  context: InvestigationContext,
  attempt: 1 | 2,
  signal?: AbortSignal,
) => Promise<unknown>;

export function supervisorPrompt(): string {
  return 'The server validates scope. The supervisor delegates validation of tokenized facts to exactly one assigned specialist per branch.';
}

export const invokeSocSupervisor: SupervisorInvoker = async context => {
  InvestigationContextSchema.parse(context);
  return { scopeValidated: true, specialists: [...expectedSpecialists] };
};
