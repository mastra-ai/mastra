// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import { WizardProvider, useWizard } from '../../../../contexts/wizard-context';
import type { useBuilderAgentFeatures } from '../../../../hooks/use-builder-agent-features';
import { AgentProfileLibraryStep } from '../agent-profile-library-step';
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
  const { step, next } = useWizard();
  return (
    <>
      <div data-testid="current-step">{step}</div>
      <button type="button" data-testid="probe-next" onClick={next}>
        next
      </button>
    </>
  );
};

// Onboarding tree (configured integration): ready>identity>instructions>library>integrations>end.
const advanceToLibrary = (getByTestId: (id: string) => HTMLElement) => {
  while (getByTestId('current-step').textContent !== 'library') {
    fireEvent.click(getByTestId('probe-next'));
  }
};

const renderLibrary = () => {
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
                    <AgentProfileLibraryStep />
                  </WizardProvider>
                </AgentColorProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));

describe('AgentProfileLibraryStep', () => {
  beforeEach(() => {
    // A configured integration keeps `integrations` after `library`, so the
    // library step renders its own Continue CTA (not the last-step CTAs).
    server.use(
      http.get('*/api/channels/platforms', () =>
        HttpResponse.json([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      ),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('renders explanatory copy about adding to the library', async () => {
    const { getByTestId, getByText } = renderLibrary();
    await flush();

    expect(getByTestId('agent-builder-library-step')).toBeTruthy();
    expect(getByText(/Add to your library/i)).toBeTruthy();
    expect(getByText(/visible to everyone in your workspace/i)).toBeTruthy();
  });

  it('advances the wizard on Continue without any visibility mutation', async () => {
    const onMutate = vi.fn();
    server.use(
      http.patch('*/api/stored/agents/:id', () => {
        onMutate();
        return HttpResponse.json({});
      }),
    );

    const { getByTestId, getByRole } = renderLibrary();
    await flush();

    advanceToLibrary(getByTestId);
    expect(getByTestId('current-step').textContent).toBe('library');
    fireEvent.click(getByRole('button', { name: /continue/i }));
    expect(getByTestId('current-step').textContent).toBe('integrations');
    expect(onMutate).not.toHaveBeenCalled();
  });
});
