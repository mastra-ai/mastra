import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import { StreamRunningContext } from '../../../../contexts/stream-chat-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { AgentProfileModelStep } from '../agent-profile-model-step';
import { makeBuilderSettings, openaiBuilderModels } from './fixtures/agent-profile-tabs';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const Harness = ({ isStreaming = false, children }: { isStreaming?: boolean; children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'Test Agent',
      model: { provider: 'openai.chat', name: 'gpt-5-mini' },
    } as AgentBuilderEditFormValues,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FormProvider {...methods}>
            <AgentColorProvider agentId="agent_test">
              <StreamRunningContext.Provider value={{ isRunning: isStreaming }}>
                {children}
              </StreamRunningContext.Provider>
            </AgentColorProvider>
          </FormProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const installHandlers = () => {
  server.use(
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(makeBuilderSettings())),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json(openaiBuilderModels)),
  );
};

describe('AgentProfileModelStep', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the model picker editable when the builder stream is idle', async () => {
    installHandlers();

    render(
      <Harness isStreaming={false}>
        <AgentProfileModelStep />
      </Harness>,
    );

    const card = await screen.findByTestId('model-card-openai-gpt-5-mini');
    expect((card.querySelector('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders the onboarding picker with a bordered title section and full-height body', async () => {
    installHandlers();

    render(
      <Harness>
        <AgentProfileModelStep />
      </Harness>,
    );

    await screen.findByTestId('model-card-openai-gpt-5-mini');
    expect(screen.getByTestId('agent-step-title-section').className).toContain('border-b');
    expect(screen.getByText('Selected model:').parentElement?.className).toContain('w-1/2');
    expect(screen.getByTestId('agent-step-content').className).toContain('overflow-hidden');
    expect(screen.getByTestId('models-provider-filter').className).toContain('h-full');
    expect(screen.getByTestId('agent-step-footer').className).toContain('border-t');
  });

  it('makes the model picker read-only while the builder stream runs (parity with the Tools step)', async () => {
    installHandlers();

    render(
      <Harness isStreaming>
        <AgentProfileModelStep />
      </Harness>,
    );

    const card = await screen.findByTestId('model-card-openai-gpt-5-mini');
    expect((card.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the cleaned provider id in the selected-model badge (parity with the main Models pane)', async () => {
    installHandlers();

    render(
      <Harness>
        <AgentProfileModelStep />
      </Harness>,
    );

    await screen.findByTestId('model-card-openai-gpt-5-mini');
    // Form stores the raw router provider id ('openai.chat'); the badge must
    // display the cleaned 'openai/gpt-5-mini', never 'openai.chat/gpt-5-mini'.
    expect(screen.getByText(/openai\/gpt-5-mini/)).toBeTruthy();
    expect(screen.queryByText(/openai\.chat\/gpt-5-mini/)).toBeNull();
  });
});
