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
import { AgentProfileAvatar } from '../agent-profile-avatar';
import { buildBuilderSettings } from './fixtures/builder';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

/**
 * Drives `useBuilderAgentFeatures` through the real builder-settings query
 * (`GET /api/editor/builder/settings`) instead of mocking the hook, so the
 * avatar's feature gating is exercised against the live data flow.
 */
const registerSettings = (avatarUpload: boolean) => {
  let resolved = false;
  server.use(
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => {
      resolved = true;
      return HttpResponse.json(buildBuilderSettings({ features: { agent: { ...allFeaturesOff, avatarUpload } } }));
    }),
  );
  return { whenSettingsResolved: () => waitFor(() => expect(resolved).toBe(true)) };
};

const allFeaturesOff = {
  tools: false,
  memory: false,
  workflows: false,
  agents: false,
  skills: false,
  avatarUpload: false,
  model: false,
  favorites: false,
  browser: false,
};

const Wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'My agent',
      description: '',
      instructions: '',
      tools: {},
      skills: {},
    } as AgentBuilderEditFormValues,
  });
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

describe('AgentProfileAvatar', () => {
  afterEach(() => {
    cleanup();
  });

  describe('when the avatarUpload feature is enabled', () => {
    it('renders the upload trigger', async () => {
      registerSettings(true);
      const { findByTestId } = render(
        <Wrapper>
          <AgentProfileAvatar />
        </Wrapper>,
      );

      expect(await findByTestId('agent-configure-avatar-trigger')).not.toBeNull();
    });

    it('does not render the read-only display', async () => {
      registerSettings(true);
      const { findByTestId, queryByTestId } = render(
        <Wrapper>
          <AgentProfileAvatar />
        </Wrapper>,
      );

      await findByTestId('agent-configure-avatar-trigger');
      expect(queryByTestId('agent-configure-avatar-display')).toBeNull();
    });
  });

  describe('when the avatarUpload feature is disabled', () => {
    it('renders the read-only display', async () => {
      registerSettings(false);
      const { findByTestId } = render(
        <Wrapper>
          <AgentProfileAvatar />
        </Wrapper>,
      );

      expect(await findByTestId('agent-configure-avatar-display')).not.toBeNull();
    });

    it('does not render the upload trigger', async () => {
      const { whenSettingsResolved } = registerSettings(false);
      const { queryByTestId } = render(
        <Wrapper>
          <AgentProfileAvatar />
        </Wrapper>,
      );

      await whenSettingsResolved();
      expect(queryByTestId('agent-configure-avatar-trigger')).toBeNull();
    });
  });
});
