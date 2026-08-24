import type { ChannelPlatformInfo } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useBuilderPaneGates } from '../use-builder-pane-gates';
import { buildBuilderSettings } from './fixtures/builder-settings';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SETTINGS_URL = `${BASE_URL}/api/editor/builder/settings`;
const PLATFORMS_URL = `${BASE_URL}/api/channels/platforms`;

const platform = (overrides: Partial<ChannelPlatformInfo> = {}): ChannelPlatformInfo => ({
  id: 'slack',
  name: 'Slack',
  isConfigured: true,
  ...overrides,
});

const renderGates = ({
  settings = buildBuilderSettings(),
  platforms = [platform()],
  hasAgentTools = true,
  hasSkills = true,
}: {
  settings?: ReturnType<typeof buildBuilderSettings>;
  platforms?: ChannelPlatformInfo[];
  hasAgentTools?: boolean;
  hasSkills?: boolean;
} = {}) => {
  server.use(http.get(SETTINGS_URL, () => HttpResponse.json(settings)));
  server.use(http.get(PLATFORMS_URL, () => HttpResponse.json(platforms)));

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );

  return renderHook(() => useBuilderPaneGates({ hasAgentTools, hasSkills }), { wrapper });
};

describe('useBuilderPaneGates', () => {
  describe('when everything is configured', () => {
    it('opens every pane', async () => {
      const { result } = renderGates();

      await waitFor(() => expect(result.current.integrations).toBe(true));
      expect(result.current).toEqual({
        model: true,
        tools: true,
        skills: true,
        browser: true,
        integrations: true,
      });
    });
  });

  describe('integrations pane', () => {
    it('stays closed when Slack is not configured', async () => {
      const { result } = renderGates({ platforms: [platform({ isConfigured: false })] });

      await waitFor(() => expect(result.current.model).toBe(true));
      expect(result.current.integrations).toBe(false);
    });

    it('stays closed when the only configured platform is not Slack', async () => {
      const { result } = renderGates({ platforms: [platform({ id: 'discord', name: 'Discord' })] });

      await waitFor(() => expect(result.current.model).toBe(true));
      expect(result.current.integrations).toBe(false);
    });

    it('opens when Slack is configured alongside other platforms', async () => {
      const { result } = renderGates({
        platforms: [platform({ id: 'discord', name: 'Discord', isConfigured: false }), platform()],
      });

      await waitFor(() => expect(result.current.integrations).toBe(true));
    });

    it('stays closed while the platform list is still loading', () => {
      const { result } = renderGates();

      // First render: the query has not resolved, so the default empty list applies.
      expect(result.current.integrations).toBe(false);
    });

    it('stays closed when the server reports no platforms', async () => {
      const { result } = renderGates({ platforms: [] });

      await waitFor(() => expect(result.current.model).toBe(true));
      expect(result.current.integrations).toBe(false);
    });
  });

  describe('tools pane', () => {
    it('stays closed when the agent has nothing to pick', async () => {
      const { result } = renderGates({ hasAgentTools: false });

      await waitFor(() => expect(result.current.model).toBe(true));
      expect(result.current.tools).toBe(false);
    });

    it('stays closed when every tool-ish feature is off', async () => {
      const { result } = renderGates({
        settings: buildBuilderSettings({
          features: { agent: { tools: false, agents: false, workflows: false, skills: true, model: true } },
        }),
      });

      await waitFor(() => expect(result.current.skills).toBe(true));
      expect(result.current.tools).toBe(false);
    });

    it.each(['tools', 'agents', 'workflows'])('opens when only the %s feature is on', async feature => {
      const { result } = renderGates({
        settings: buildBuilderSettings({
          features: { agent: { tools: false, agents: false, workflows: false, [feature]: true } },
        }),
      });

      await waitFor(() => expect(result.current.tools).toBe(true));
    });
  });

  describe('skills pane', () => {
    it('stays closed when no stored skill exists to pick', async () => {
      const { result } = renderGates({ hasSkills: false });

      await waitFor(() => expect(result.current.model).toBe(true));
      expect(result.current.skills).toBe(false);
    });

    it('stays closed when the skills feature is off', async () => {
      const { result } = renderGates({
        settings: buildBuilderSettings({ features: { agent: { skills: false, model: true } } }),
      });

      await waitFor(() => expect(result.current.model).toBe(true));
      expect(result.current.skills).toBe(false);
    });
  });

  describe('model pane', () => {
    it('opens on an active model policy even when the model feature is off', async () => {
      const { result } = renderGates({
        settings: buildBuilderSettings({
          features: { agent: { model: false } },
          modelPolicy: { active: true, allowed: [{ provider: 'openai', modelId: 'gpt-4o' }] },
        }),
      });

      await waitFor(() => expect(result.current.model).toBe(true));
    });

    it('stays closed when neither the feature nor a policy enables it', async () => {
      const { result } = renderGates({
        settings: buildBuilderSettings({
          features: { agent: { model: false, browser: true } },
          modelPolicy: { active: false, allowed: [] },
        }),
      });

      await waitFor(() => expect(result.current.browser).toBe(true));
      expect(result.current.model).toBe(false);
    });
  });
});
