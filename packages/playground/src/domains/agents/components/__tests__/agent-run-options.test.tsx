import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import {
  RequestContextProvider,
  RequestContextSchemaFormRendererProvider,
} from '@mastra/playground-ui/domains/request-context';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { stringify } from 'superjson';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { TracingSettingsProvider } from '../../../observability/context/tracing-settings-context';
import { AgentEditFormProvider } from '../../context/agent-edit-form-context';
import type { AgentFormValues } from '../agent-edit-page/utils/form-validation';
import { AgentRunOptions } from '../agent-run-options';
import { RequestContextSchemaFormRenderer } from '@/lib/form/request-context-schema-form-renderer';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

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
              <RequestContextSchemaFormRendererProvider render={RequestContextSchemaFormRenderer}>
                <RequestContextProvider entityKey={`agent:${AGENT_ID}`}>{ui}</RequestContextProvider>
              </RequestContextSchemaFormRendererProvider>
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

const requestContextSection = () => screen.getByRole('region', { name: 'Request context' });
const tracingSection = () => screen.getByRole('region', { name: 'Additional run options' });
const saveAllButton = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;

function AgentVariablesHarness({ children }: { children: React.ReactNode }) {
  const form = useForm<AgentFormValues>({
    defaultValues: {
      name: 'Test Agent',
      instructions: 'Run the test agent.',
      model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      variables: {
        type: 'object',
        properties: {
          locale: { type: 'string', minLength: 2 },
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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete (window as typeof window & { MASTRA_REQUEST_CONTEXT_PRESETS?: string }).MASTRA_REQUEST_CONTEXT_PRESETS;
});

describe('AgentRunOptions', () => {
  describe('when the composer trigger is opened without a schema', () => {
    it('shows the request context and tracing editors side by side', async () => {
      renderRunOptions(<AgentRunOptions triggerVariant="icon" />);

      await openByTestId('composer-run-options-trigger');

      expect(await screen.findByRole('heading', { name: /run options/i })).not.toBeNull();
      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();
      expect(await screen.findByText('Tracing Options (JSON)')).not.toBeNull();
      expect(
        await screen.findByText('Request context values are passed into experiments and test chats.'),
      ).not.toBeNull();
    }, 15_000);

    it('disables the single Save button until the request context draft changes and supports revert', async () => {
      (window as typeof window & { MASTRA_REQUEST_CONTEXT_PRESETS?: string }).MASTRA_REQUEST_CONTEXT_PRESETS =
        JSON.stringify({
          French: { locale: 'fr' },
        });

      renderRunOptions(<AgentRunOptions triggerVariant="icon" />);

      await openByTestId('composer-run-options-trigger');

      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();

      const saveButton = saveAllButton();
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
      fireEvent.click(revertButton);

      await waitFor(() => {
        expect(saveButton.disabled).toBe(true);
      });
      expect(screen.queryByRole('button', { name: /revert request context changes/i })).toBeNull();
    }, 15_000);

    it('persists tracing options only when Save is clicked', async () => {
      renderRunOptions(<AgentRunOptions triggerVariant="icon" />);

      await openByTestId('composer-run-options-trigger');
      await screen.findByText('Tracing Options (JSON)');

      const tracing = tracingSection();
      const saveButton = saveAllButton();
      expect(saveButton.disabled).toBe(true);

      const editor = tracing.querySelector('.cm-content');
      expect(editor).not.toBeNull();
      fireEvent.input(editor!, { target: { textContent: '{"metadata":{"env":"test"}}' } });

      await waitFor(() => expect(saveButton.disabled).toBe(false));
      expect(window.localStorage.getItem(`tracing-options-agent:${AGENT_ID}`)).toBeNull();

      fireEvent.click(saveButton);

      await waitFor(() => {
        const stored = JSON.parse(window.localStorage.getItem(`tracing-options-agent:${AGENT_ID}`) ?? '{}');
        expect(stored.tracingOptions).toEqual({ metadata: { env: 'test' } });
      });
    }, 15_000);
  });

  describe('when the agent defines a request context schema', () => {
    it('renders the schema-driven form', async () => {
      const requestContextSchema = stringify({
        type: 'object',
        properties: { userId: { type: 'string' } },
        required: [],
      });

      renderRunOptions(<AgentRunOptions triggerVariant="icon" requestContextSchema={requestContextSchema} />);

      await openByTestId('composer-run-options-trigger');

      expect(await screen.findByText('Request Context')).not.toBeNull();
      expect(within(requestContextSection()).queryByRole('button', { name: /save/i })).toBeNull();
      expect(saveAllButton()).not.toBeNull();
    });
  });

  describe('when editor variables exist without a code request context schema', () => {
    it('renders a variables-backed form with a JSON toggle', async () => {
      renderRunOptions(
        <AgentVariablesHarness>
          <AgentRunOptions triggerVariant="icon" />
        </AgentVariablesHarness>,
      );

      await openByTestId('composer-run-options-trigger');

      expect(await screen.findByText('Request Context')).not.toBeNull();
      expect(within(requestContextSection()).queryByRole('button', { name: /save/i })).toBeNull();
      expect(saveAllButton()).not.toBeNull();
      expect(screen.getByRole('button', { name: /json/i })).not.toBeNull();
    });
  });

  describe.each(['schema', 'variables'] as const)('when the %s form contains an invalid value', source => {
    it('keeps the saved context unchanged until the value is corrected', async () => {
      const storageKey = `mastra:request-context:agent:${AGENT_ID}`;
      window.localStorage.setItem(storageKey, JSON.stringify({ locale: 'en' }));
      const requestContextSchema = stringify({
        type: 'object',
        properties: { locale: { type: 'string', minLength: 2 } },
        required: ['locale'],
      });
      renderRunOptions(
        source === 'schema' ? (
          <AgentRunOptions triggerVariant="icon" requestContextSchema={requestContextSchema} />
        ) : (
          <AgentVariablesHarness>
            <AgentRunOptions triggerVariant="icon" />
          </AgentVariablesHarness>
        ),
      );
      await openByTestId('composer-run-options-trigger');
      const input = within(requestContextSection()).getByRole('textbox');
      fireEvent.change(input, { target: { value: 'f' } });
      fireEvent.click(saveAllButton());

      await waitFor(() => {
        expect(JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')).toEqual({ locale: 'en' });
        expect(within(requestContextSection()).getByText(/at least 2/i)).not.toBeNull();
      });

      fireEvent.change(input, { target: { value: 'fr' } });
      fireEvent.click(saveAllButton());
      await waitFor(() => {
        expect(JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')).toEqual({ locale: 'fr' });
      });
    });
  });

  describe('when the labelled trigger variant is used', () => {
    it('renders the top bar trigger', async () => {
      renderRunOptions(<AgentRunOptions triggerVariant="labelled" />);

      expect(await screen.findByTestId('agent-top-bar-run-options-trigger')).not.toBeNull();
    });
  });
});
