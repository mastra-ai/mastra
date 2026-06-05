import { Agent } from '@mastra/core/agent';

import { AGENT_GENERATION_MODEL_SETTINGS } from '../constant';
import type { AgentFactoryArgs } from './types';

/**
 * Agent that decides whether the agent warrants browser access.
 */
export const createBrowserAgent = ({ model }: AgentFactoryArgs) =>
  new Agent({
    id: 'agent-builder-browser-agent',
    name: 'Agent Builder Browser Agent',
    model,
    defaultOptions: { modelSettings: AGENT_GENERATION_MODEL_SETTINGS },
    instructions: [
      'You decide whether an AI agent needs browser access to achieve its outcome.',
      'Enable browser access only when the agent must navigate or read live web pages.',
      'When in doubt, prefer not enabling browser access.',
    ].join(' '),
  });
