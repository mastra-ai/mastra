import type {
  BuilderSettingsResponse,
  ChannelPlatformInfo,
  ListToolProvidersResponse,
  StoredSkillResponse,
} from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';

import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import type { AgentTool } from '../../../../types/agent-tool';
import { AgentProfileTabs } from '../agent-profile-tabs';
import {
  allAgentFeatures,
  makeBuilderSettings,
  nativeTool,
  noBuilderModels,
  noToolProviders,
  slackConfigured,
  slackUnconfigured,
  storedSkill,
} from './fixtures/agent-profile-tabs';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

interface HandlerOptions {
  settings?: BuilderSettingsResponse;
  platforms?: ChannelPlatformInfo[];
  toolProviders?: ListToolProvidersResponse | Promise<ListToolProvidersResponse>;
}

const useHandlers = ({
  settings = makeBuilderSettings(),
  platforms = [],
  toolProviders = noToolProviders,
}: HandlerOptions = {}) => {
  server.use(
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(settings)),
    http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(platforms)),
    http.get(`${BASE_URL}/api/tool-providers`, async () => HttpResponse.json(await toolProviders)),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json(noBuilderModels)),
  );
};

/** Deferred used to hold the tool-providers response pending until released. */
const createGate = () => {
  let release!: (value: ListToolProvidersResponse) => void;
  const response = new Promise<ListToolProvidersResponse>(resolve => {
    release = resolve;
  });
  return { response, release };
};

const Wrapper = ({ children }: { children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'My agent',
      description: '',
      instructions: '',
      tools: {},
      skills: {},
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <FormProvider {...methods}>
            <AgentColorProvider agentId="agent_test">{children}</AgentColorProvider>
          </FormProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const renderTabs = ({
  availableAgentTools = [],
  availableSkills = [],
}: {
  availableAgentTools?: AgentTool[];
  availableSkills?: StoredSkillResponse[];
} = {}) =>
  render(
    <Wrapper>
      <AgentProfileTabs agentId="agent-1" availableAgentTools={availableAgentTools} availableSkills={availableSkills} />
    </Wrapper>,
  );

const tabLabels = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[role="tab"]')).map(tab => tab.textContent);

describe('AgentProfileTabs', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders Model, Tools, Instructions, and Skills tabs in wizard order when features are enabled and items are available', async () => {
    useHandlers();
    const { container } = renderTabs({ availableAgentTools: [nativeTool], availableSkills: [storedSkill] });

    await waitFor(() => {
      expect(tabLabels(container)).toEqual(['Model', 'Tools', 'Instructions', 'Skills']);
    });
  });

  it('hides the Tools tab when no tools are available after provider tools resolve', async () => {
    useHandlers();
    const { container } = renderTabs();

    await waitFor(() => {
      expect(tabLabels(container)).toContain('Model');
    });
    await waitFor(() => {
      expect(tabLabels(container)).not.toContain('Tools');
    });
    expect(tabLabels(container)).not.toContain('Skills');
  });

  it('hides the Skills tab when the skills feature is disabled', async () => {
    useHandlers({ settings: makeBuilderSettings({ ...allAgentFeatures, skills: false }) });
    const { container } = renderTabs({ availableSkills: [storedSkill] });

    await waitFor(() => {
      expect(tabLabels(container)).toContain('Model');
    });
    expect(tabLabels(container)).not.toContain('Skills');
  });

  it('hides the Model tab when the model feature is off and no policy is active', async () => {
    useHandlers({ settings: makeBuilderSettings({ ...allAgentFeatures, model: false }) });
    const { container } = renderTabs({ availableAgentTools: [nativeTool] });

    await waitFor(() => {
      expect(tabLabels(container)).toContain('Tools');
    });
    expect(tabLabels(container)).not.toContain('Model');
    expect(tabLabels(container)).toContain('Instructions');
  });

  it('shows the Model tab when the model feature is off but the admin policy is active', async () => {
    useHandlers({ settings: makeBuilderSettings({ ...allAgentFeatures, model: false }, { active: true }) });
    const { container } = renderTabs({ availableAgentTools: [nativeTool] });

    await waitFor(() => {
      expect(tabLabels(container)).toContain('Model');
    });
  });

  it('shows the Tools tab while integration tools are loading, then hides it when none exist', async () => {
    const gate = createGate();
    useHandlers({ toolProviders: gate.response });
    const { container } = renderTabs();

    // Tool availability is unknown while provider tools load — keep the tab.
    await waitFor(() => {
      expect(tabLabels(container)).toContain('Model');
    });
    expect(tabLabels(container)).toContain('Tools');

    gate.release(noToolProviders);

    await waitFor(() => {
      expect(tabLabels(container)).not.toContain('Tools');
    });
  });

  it('shows the Integrations tab when Slack is configured', async () => {
    useHandlers({ platforms: slackConfigured });
    const { container } = renderTabs();

    await waitFor(() => {
      expect(tabLabels(container)).toContain('Integrations');
    });
  });

  it('hides the Integrations tab when Slack is not configured', async () => {
    useHandlers({ platforms: slackUnconfigured });
    const { container } = renderTabs();

    await waitFor(() => {
      expect(tabLabels(container)).toContain('Model');
    });
    expect(tabLabels(container)).not.toContain('Integrations');
  });

  it('always renders the Instructions tab', async () => {
    useHandlers({
      settings: makeBuilderSettings({
        ...allAgentFeatures,
        model: false,
        tools: false,
        agents: false,
        workflows: false,
        skills: false,
      }),
    });
    const { container } = renderTabs();

    await waitFor(() => {
      expect(tabLabels(container)).toEqual(['Instructions']);
    });
  });
});
