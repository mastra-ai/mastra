// @vitest-environment jsdom
import type { BuilderAvailableModelsResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { AgentProfileTabs } from '../agent-profile-tabs';

const builderFeatures = {
  tools: true,
  memory: true,
  workflows: true,
  agents: true,
  skills: true,
  avatarUpload: true,
  model: true,
  favorites: true,
  browser: false,
};

const defaultTabsProps = {
  agentId: 'agent-1',
};

const channelPlatforms: Array<{ id: string; isConfigured: boolean }> = [];

const modelPolicy = {
  active: false,
  allowed: undefined as unknown,
  pickerVisible: true,
  default: undefined as unknown,
};

vi.mock('@/domains/agent-builder/hooks/use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => builderFeatures,
}));

vi.mock('@/domains/agent-builder', () => ({
  useBuilderModelPolicy: () => modelPolicy,
}));

vi.mock('@/domains/llm', () => ({
  useAllModels: () => [],
  ProviderLogo: () => null,
  cleanProviderId: (id: string) => id,
}));

vi.mock('@mastra/react', () => ({
  useMastraClient: () => ({
    getBuilderAvailableModels: async (): Promise<BuilderAvailableModelsResponse> => ({ providers: [] }),
  }),
}));

vi.mock('@/domains/agents/hooks/use-channels', () => ({
  useChannelPlatforms: () => ({ data: channelPlatforms, isLoading: false }),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'My agent',
      description: '',
      instructions: '',
      tools: {},
      skills: {},
    } as AgentBuilderEditFormValues,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['builder-available-models'], { providers: [] });
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <FormProvider {...methods}>
          <AgentColorProvider agentId="agent_test">{children}</AgentColorProvider>
        </FormProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

const setFeatures = (overrides: Partial<typeof builderFeatures>) => {
  Object.assign(builderFeatures, overrides);
};

describe('AgentProfileTabs', () => {
  beforeEach(() => {
    setFeatures({
      tools: true,
      memory: true,
      workflows: true,
      agents: true,
      skills: true,
      avatarUpload: true,
      model: true,
      favorites: true,
      browser: false,
    });
    modelPolicy.active = false;
    modelPolicy.pickerVisible = true;
    channelPlatforms.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Model, Tools, Instructions, and Skills tabs in wizard order when features are enabled and items are available', () => {
    const { getAllByRole } = render(
      <Wrapper>
        <AgentProfileTabs
          {...defaultTabsProps}
          availableAgentTools={[{ id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' }]}
          availableSkills={[{ id: 'skill-a', name: 'skill-a' } as never]}
        />
      </Wrapper>,
    );

    const tabs = getAllByRole('tab').map(tab => tab.textContent);
    expect(tabs).toEqual(['Model', 'Tools', 'Instructions', 'Skills']);
  });

  it('hides the Tools tab when no tools are available', () => {
    const { getAllByRole } = render(
      <Wrapper>
        <AgentProfileTabs {...defaultTabsProps} availableAgentTools={[]} availableSkills={[]} />
      </Wrapper>,
    );

    const tabs = getAllByRole('tab').map(tab => tab.textContent);
    expect(tabs).not.toContain('Tools');
    expect(tabs).not.toContain('Skills');
  });

  it('hides the Skills tab when the skills feature is disabled', () => {
    setFeatures({ skills: false });
    const { getAllByRole } = render(
      <Wrapper>
        <AgentProfileTabs
          {...defaultTabsProps}
          availableAgentTools={[]}
          availableSkills={[{ id: 'skill-a', name: 'skill-a' } as never]}
        />
      </Wrapper>,
    );

    const tabs = getAllByRole('tab').map(tab => tab.textContent);
    expect(tabs).not.toContain('Skills');
  });

  it('hides the Model tab when the model feature is off and no policy is active', () => {
    setFeatures({ model: false });
    const { getAllByRole } = render(
      <Wrapper>
        <AgentProfileTabs {...defaultTabsProps} availableAgentTools={[]} availableSkills={[]} />
      </Wrapper>,
    );

    const tabs = getAllByRole('tab').map(tab => tab.textContent);
    expect(tabs).not.toContain('Model');
    expect(tabs).toContain('Instructions');
  });

  it('shows the Integrations tab when Slack is configured', () => {
    channelPlatforms.push({ id: 'slack', isConfigured: true });
    const { getAllByRole } = render(
      <Wrapper>
        <AgentProfileTabs {...defaultTabsProps} availableAgentTools={[]} availableSkills={[]} />
      </Wrapper>,
    );

    const tabs = getAllByRole('tab').map(tab => tab.textContent);
    expect(tabs).toContain('Integrations');
  });

  it('hides the Integrations tab when Slack is not configured', () => {
    channelPlatforms.push({ id: 'slack', isConfigured: false });
    const { getAllByRole } = render(
      <Wrapper>
        <AgentProfileTabs {...defaultTabsProps} availableAgentTools={[]} availableSkills={[]} />
      </Wrapper>,
    );

    const tabs = getAllByRole('tab').map(tab => tab.textContent);
    expect(tabs).not.toContain('Integrations');
  });

  it('always renders the Instructions tab', () => {
    setFeatures({ model: false, tools: false, agents: false, workflows: false, skills: false });
    const { getAllByRole } = render(
      <Wrapper>
        <AgentProfileTabs {...defaultTabsProps} availableAgentTools={[]} availableSkills={[]} />
      </Wrapper>,
    );

    const tabs = getAllByRole('tab').map(tab => tab.textContent);
    expect(tabs).toEqual(['Instructions']);
  });
});
