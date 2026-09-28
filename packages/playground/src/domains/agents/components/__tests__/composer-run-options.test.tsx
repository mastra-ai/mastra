import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { TracingSettingsProvider } from '@mastra/playground-ui/domains/observability/context/tracing-settings-context';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { stringify } from 'superjson';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  SchemaRequestContextProvider,
  useLocalRequestContext,
} from '../../../request-context/context/schema-request-context';
import { AgentEditFormProvider } from '../../context/agent-edit-form-context';
import type { AgentFormValues } from '../agent-edit-page/utils/form-validation';
import { ComposerRunOptions } from '../composer-run-options';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

const renderRunOptions = (ui: React.ReactNode, entityId = AGENT_ID) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <TracingSettingsProvider entityId={AGENT_ID} entityType="agent">
              <SchemaRequestContextProvider entityType="agent" entityId={entityId}>
                {ui}
              </SchemaRequestContextProvider>
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

function AgentVariablesHarness({ children }: { children: React.ReactNode }) {
  const form = useForm<AgentFormValues>({
    defaultValues: {
      name: 'Test Agent',
      instructions: 'Run the test agent.',
      model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      variables: {
        type: 'object',
        properties: {
          locale: { type: 'string' },
        },
        required: [],
      },
    },
  });

  return (
    <AgentEditFormProvider form={form} mode="edit" isSubmitting={false} handlePublish={async () => {}}>
      {children}
    </AgentEditFormProvider>
  );
}

function LocalContextProbe() {
  return <output data-testid="local-request-context">{JSON.stringify(useLocalRequestContext())}</output>;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete (window as typeof window & { MASTRA_REQUEST_CONTEXT_PRESETS?: string }).MASTRA_REQUEST_CONTEXT_PRESETS;
});

describe('ComposerRunOptions', () => {
  it('opens one composer popover that exposes the tracing options editor', async () => {
    renderRunOptions(<ComposerRunOptions />);

    await openByTestId('composer-run-options-trigger');

    expect(await screen.findByRole('heading', { name: /run options/i })).not.toBeNull();
    expect(await screen.findByRole('button', { name: /context details/i })).not.toBeNull();
    expect(await screen.findByText('Tracing Options (JSON)')).not.toBeNull();
    expect(await screen.findByText('Auto-applied on valid JSON')).not.toBeNull();
    expect(await screen.findByRole('tooltip')).not.toBeNull();
    expect(
      await screen.findByText('Request context values are passed into experiments and test chats.'),
    ).not.toBeNull();
  });

  it('falls back to the free-form request context editor when the agent has no schema', async () => {
    renderRunOptions(<ComposerRunOptions />);

    await openByTestId('composer-run-options-trigger');

    // The free-form editor lazy-loads prettier for JSON formatting, so allow
    // extra time for the cold import in CI.
    expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();
  }, 15_000);

  it('disables free-form request context save until the draft changes and supports revert', async () => {
    (window as typeof window & { MASTRA_REQUEST_CONTEXT_PRESETS?: string }).MASTRA_REQUEST_CONTEXT_PRESETS =
      JSON.stringify({
        French: { locale: 'fr' },
      });

    renderRunOptions(<ComposerRunOptions />);

    await openByTestId('composer-run-options-trigger');

    expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();

    const saveButton = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /revert request context changes/i })).toBeNull();

    fireEvent.click(screen.getByRole('combobox'));
    const presetOption = await screen.findByRole('option', { name: 'French' });
    fireEvent.pointerDown(presetOption, { pointerType: 'mouse' });
    fireEvent.click(presetOption, { detail: 1 });

    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    const revertButton = screen.getByRole('button', { name: /revert request context changes/i });
    expect(revertButton).not.toBeNull();

    fireEvent.click(revertButton);

    await waitFor(() => {
      expect(saveButton.disabled).toBe(true);
    });
    expect(screen.queryByRole('button', { name: /revert request context changes/i })).toBeNull();
  }, 15_000);

  it('renders the schema-driven form when the agent defines a request context schema', async () => {
    const requestContextSchema = stringify({
      type: 'object',
      properties: { userId: { type: 'string' } },
      required: [],
    });

    renderRunOptions(<ComposerRunOptions requestContextSchema={requestContextSchema} />);

    await openByTestId('composer-run-options-trigger');

    expect(await screen.findByText('Request Context')).not.toBeNull();
    expect(await screen.findByRole('button', { name: /save/i })).not.toBeNull();
  });

  it('renders a variables-backed form when editor variables exist without a code request context schema', async () => {
    renderRunOptions(
      <AgentVariablesHarness>
        <ComposerRunOptions />
      </AgentVariablesHarness>,
    );

    await openByTestId('composer-run-options-trigger');

    expect(await screen.findByText('Request Context')).not.toBeNull();
    expect(await screen.findByRole('button', { name: /save/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: /json/i })).not.toBeNull();
  });

  it('persists the saved request context per agent and restores it after remount', async () => {
    (window as typeof window & { MASTRA_REQUEST_CONTEXT_PRESETS?: string }).MASTRA_REQUEST_CONTEXT_PRESETS =
      JSON.stringify({ French: { locale: 'fr' } });

    const view = renderRunOptions(
      <>
        <ComposerRunOptions />
        <LocalContextProbe />
      </>,
    );
    await openByTestId('composer-run-options-trigger');
    expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();

    fireEvent.click(screen.getByRole('combobox'));
    const presetOption = await screen.findByRole('option', { name: 'French' });
    fireEvent.pointerDown(presetOption, { pointerType: 'mouse' });
    fireEvent.click(presetOption, { detail: 1 });
    const saveButton = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    await waitFor(() => expect(saveButton.disabled).toBe(false));
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('local-request-context').textContent).toBe('{"locale":"fr"}');
    });
    expect(JSON.parse(window.localStorage.getItem(`mastra-request-context:agent:${AGENT_ID}`) ?? 'null')).toEqual({
      locale: 'fr',
    });

    view.unmount();
    renderRunOptions(<LocalContextProbe />);
    expect(screen.getByTestId('local-request-context').textContent).toBe('{"locale":"fr"}');

    cleanup();
    renderRunOptions(<LocalContextProbe />, 'agent-2');
    expect(screen.getByTestId('local-request-context').textContent).toBe('{}');
  }, 15_000);
});
