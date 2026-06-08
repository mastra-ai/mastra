// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { useBuilderAgentFeatures } from '../../../../hooks/use-builder-agent-features';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import { WizardProvider, useWizard } from '../../../../contexts/wizard-context';
import { AgentProfileReadyStep } from '../agent-profile-ready-step';
import { server } from '@/test/msw-server';

type Features = ReturnType<typeof useBuilderAgentFeatures>;

const DEFAULT_FEATURES: Features = {
  tools: false,
  memory: false,
  workflows: false,
  agents: false,
  avatarUpload: false,
  skills: false,
  model: false,
  favorites: false,
  browser: false,
};

vi.mock('@/domains/agent-builder/hooks/use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => DEFAULT_FEATURES,
}));

vi.mock('@/domains/agent-builder/contexts/agent-primitives-context', () => ({
  useAgentPrimitives: () => ({ availableSkills: [] }),
}));

const BASE_URL = 'http://localhost:4111';

const StepProbe = () => {
  const { step } = useWizard();
  return <div data-testid="current-step">{step}</div>;
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderReady = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/agent-builder/agents/agent_test/edit']}>
          <Routes>
            <Route
              path="/agent-builder/agents/:id/edit"
              element={
                <AgentColorProvider agentId="agent_test">
                  <WizardProvider initialStep="ready">
                    <StepProbe />
                    <AgentProfileReadyStep />
                  </WizardProvider>
                </AgentColorProvider>
              }
            />
            <Route path="/agent-builder/agents/:id/view" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));

describe('AgentProfileReadyStep', () => {
  beforeEach(() => {
    server.use(http.get('*/api/channels/platforms', () => HttpResponse.json([])));
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the ready heading and both CTAs', async () => {
    const { getByTestId } = renderReady();
    await flush();

    expect(getByTestId('agent-builder-ready-heading').textContent).toBe('Your agent is ready');
    expect(getByTestId('agent-builder-ready-review')).toBeTruthy();
    expect(getByTestId('agent-builder-ready-try')).toBeTruthy();
  });

  it('advances the wizard when "Review my agent" is clicked', async () => {
    const { getByTestId } = renderReady();
    await flush();

    expect(getByTestId('current-step').textContent).toBe('ready');
    fireEvent.click(getByTestId('agent-builder-ready-review'));
    expect(getByTestId('current-step').textContent).toBe('identity');
  });

  it('navigates to the agent view page when "Try my agent" is clicked', async () => {
    const { getByTestId } = renderReady();
    await flush();

    fireEvent.click(getByTestId('agent-builder-ready-try'));
    await waitFor(() =>
      expect(getByTestId('location').textContent).toBe('/agent-builder/agents/agent_test/view'),
    );
  });
});
