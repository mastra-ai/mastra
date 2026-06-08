// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { useBuilderAgentFeatures } from '../../../../hooks/use-builder-agent-features';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import { StreamRunningContext } from '../../../../contexts/stream-chat-context';
import { WizardProvider, useWizard, type WizardStep } from '../../../../contexts/wizard-context';
import { AgentStepContainer } from '../agent-step-container';
import { server } from '@/test/msw-server';

type Features = ReturnType<typeof useBuilderAgentFeatures>;

const FEATURES: Features = {
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
  useBuilderAgentFeatures: () => FEATURES,
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

const advanceTo = (getByTestId: (id: string) => HTMLElement, target: WizardStep) => {
  while (getByTestId('current-step').textContent !== target) {
    fireEvent.click(getByTestId('probe-next'));
  }
};

const renderContainer = ({
  isRunning = false,
}: {
  isRunning?: boolean;
} = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapped = ({ children }: { children: ReactNode }) => (
    <StreamRunningContext.Provider value={{ isRunning }}>{children}</StreamRunningContext.Provider>
  );
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
                    <Wrapped>
                      <StepProbe />
                      <AgentStepContainer cta={<button type="button">Continue</button>}>
                        <div>body</div>
                      </AgentStepContainer>
                    </Wrapped>
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

describe('AgentStepContainer back button', () => {
  beforeEach(() => {
    server.use(http.get('*/api/channels/platforms', () => HttpResponse.json([])));
  });

  afterEach(() => {
    cleanup();
  });

  it('hides the back button on the first step', async () => {
    const { queryByTestId, getByTestId } = renderContainer();
    await flush();

    expect(getByTestId('current-step').textContent).toBe('ready');
    expect(queryByTestId('agent-builder-step-back')).toBeNull();
  });

  it('shows the back button on a later step and steps backward when clicked', async () => {
    const { getByTestId } = renderContainer();
    await flush();

    advanceTo(getByTestId, 'identity');
    expect(getByTestId('current-step').textContent).toBe('identity');
    const back = getByTestId('agent-builder-step-back');
    fireEvent.click(back);
    expect(getByTestId('current-step').textContent).toBe('ready');
  });

  it('disables the back button while streaming', async () => {
    const { getByTestId } = renderContainer({ isRunning: true });
    await flush();

    advanceTo(getByTestId, 'identity');
    expect((getByTestId('agent-builder-step-back') as HTMLButtonElement).disabled).toBe(true);
  });
});
