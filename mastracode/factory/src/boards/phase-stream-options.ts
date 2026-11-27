import { thinkingProviderOptions } from '@mastra/code-sdk/providers/thinking-provider-options';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { AgentExecutionOptions } from '@mastra/core/agent';

export interface PhaseStreamOptions {
  model?: string;
  providerOptions?: AgentExecutionOptions['providerOptions'];
}

/**
 * Stream options for a run a phase starts on a gateway-routed agent: the phase's model, routed through the Mastra
 * gateway, and its thinking level as that model's provider options. Thinking without a phase model maps against
 * `agentModel`. Empty when the phase picks neither, so the agent's own settings apply.
 */
export function phaseStreamOptions(
  runner: { model?: string; thinking?: ThinkingLevelSetting },
  agentModel?: string,
): PhaseStreamOptions {
  const model = runner.model && `mastra/${runner.model}`;
  const target = model ?? agentModel;
  // Built by code-sdk's per-provider mappings, the same ones its model adapters send; core types each provider's
  // keys, which a generic record can't show it matches.
  const providerOptions = (target ? thinkingProviderOptions(target, runner.thinking) : undefined) as
    | PhaseStreamOptions['providerOptions']
    | undefined;
  return { ...(model && { model }), ...(providerOptions && { providerOptions }) };
}
