import type { GetAgentResponse } from '@mastra/client-js';
import { agent } from '@/domains/experiments/components/__tests__/fixtures/target-registries';

/** Agents offered as experiment targets. */
export const targetAgents: Record<string, GetAgentResponse> = {
  'agent-1': agent('agent-1', 'Agent One'),
  'agent-2': agent('agent-2', 'Agent Two'),
};
