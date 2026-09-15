import { useMemo } from 'react';
import { useBuilderAgentFeatures } from './use-builder-agent-features';
import { useBuilderModelPolicy } from './use-builder-settings';
import { useChannelPlatforms } from '@/domains/agents/hooks/use-channels';

export interface BuilderPaneGatesInput {
  /**
   * Whether the agent has any pickable tools (native tools/agents/workflows or
   * integration tools). Pass `true` while tool availability is still loading
   * so the pane isn't hidden prematurely.
   */
  hasAgentTools: boolean;
  /** Whether at least one stored skill exists for the user to pick from. */
  hasSkills: boolean;
}

export interface BuilderPaneGates {
  model: boolean;
  tools: boolean;
  skills: boolean;
  browser: boolean;
  integrations: boolean;
}

/**
 * Single source of truth for which agent-builder configuration panes are
 * available. Consumed by both `AgentProfileTabs` (regular edit path) and the
 * onboarding wizard (`WizardProvider`) so the two can never drift apart.
 */
export const useBuilderPaneGates = ({ hasAgentTools, hasSkills }: BuilderPaneGatesInput): BuilderPaneGates => {
  const features = useBuilderAgentFeatures();
  const policy = useBuilderModelPolicy();
  const { data: channelPlatforms = [] } = useChannelPlatforms();

  const model = features.model || policy.active;
  const tools = (features.tools || features.agents || features.workflows) && hasAgentTools;
  const skills = features.skills && hasSkills;
  const browser = features.browser;
  const integrations = channelPlatforms.some(platform => platform.id === 'slack' && platform.isConfigured);

  return useMemo(
    () => ({ model, tools, skills, browser, integrations }),
    [model, tools, skills, browser, integrations],
  );
};
