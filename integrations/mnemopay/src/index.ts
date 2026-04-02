import type { MnemoPayLite } from '@mnemopay/sdk';

import {
  createRememberTool,
  createRecallTool,
  createChargeTool,
  createSettleTool,
  createRefundTool,
  createBalanceTool,
  createProfileTool,
} from './tools';

export {
  createRememberTool,
  createRecallTool,
  createChargeTool,
  createSettleTool,
  createRefundTool,
  createBalanceTool,
  createProfileTool,
};

/**
 * Configuration options for the MnemoPay integration.
 */
export interface MnemoPayToolsConfig {
  /** A pre-configured MnemoPayLite instance from @mnemopay/sdk */
  agent: MnemoPayLite;
}

/**
 * Create all MnemoPay tools for use with a Mastra agent.
 *
 * @example
 * ```typescript
 * import { MnemoPayLite } from '@mnemopay/sdk';
 * import { createMnemoPayTools } from '@mastra/mnemopay';
 * import { Agent } from '@mastra/core/agent';
 *
 * const mnemo = new MnemoPayLite('commerce-agent', 0.05);
 * const tools = createMnemoPayTools({ agent: mnemo });
 *
 * const agent = new Agent({
 *   name: 'Commerce Agent',
 *   model: openai('gpt-4o'),
 *   instructions: 'You are a commerce agent with economic memory...',
 *   tools,
 * });
 * ```
 */
export function createMnemoPayTools(config: MnemoPayToolsConfig) {
  const { agent } = config;

  return {
    mnemopay_remember: createRememberTool(agent),
    mnemopay_recall: createRecallTool(agent),
    mnemopay_charge: createChargeTool(agent),
    mnemopay_settle: createSettleTool(agent),
    mnemopay_refund: createRefundTool(agent),
    mnemopay_balance: createBalanceTool(agent),
    mnemopay_profile: createProfileTool(agent),
  } as const;
}
