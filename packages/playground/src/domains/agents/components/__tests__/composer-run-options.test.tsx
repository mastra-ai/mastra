// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { stringify } from 'superjson';
import { afterEach, describe, expect, it } from 'vitest';

import { TracingSettingsProvider } from '../../../observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '../../../request-context/context/schema-request-context';
import { AgentTracingControls } from '../agent-tracing-controls';
import { ComposerRequestContext } from '../composer-run-options';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';

const renderRunOptions = (ui: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <TracingSettingsProvider entityId={AGENT_ID} entityType="agent">
              <SchemaRequestContextProvider>{ui}</SchemaRequestContextProvider>
            </TracingSettingsProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const openByTestId = async (testId: string) => {
  const trigger = await screen.findByTestId(testId);
  await act(async () => {
    fireEvent.click(trigger);
  });
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('AgentTracingControls', () => {
  it('opens a popover exposing the tracing options editor', async () => {
    renderRunOptions(<AgentTracingControls />);

    await openByTestId('agent-tracing-controls-trigger');

    expect(await screen.findByRole('heading', { name: /tracing options/i })).not.toBeNull();
  });
});

describe('ComposerRequestContext', () => {
  it(
    'falls back to the free-form request context editor when the agent has no schema',
    async () => {
      renderRunOptions(<ComposerRequestContext />);

      await openByTestId('composer-request-context-trigger');

      // The free-form editor lazy-loads prettier for JSON formatting, so allow
      // extra time for the cold import in CI.
      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();
    },
    15_000,
  );

  it('renders the schema-driven form when the agent defines a request context schema', async () => {
    const requestContextSchema = stringify({
      type: 'object',
      properties: { userId: { type: 'string' } },
      required: [],
    });

    renderRunOptions(<ComposerRequestContext requestContextSchema={requestContextSchema} />);

    await openByTestId('composer-request-context-trigger');

    expect(await screen.findByText('Request Context')).not.toBeNull();
    expect(await screen.findByRole('button', { name: /save/i })).not.toBeNull();
  });
});
