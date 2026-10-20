// @vitest-environment jsdom
import type { DatasetRecord, GetAgentResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddDatasetItemDialog } from '../add-dataset-item-dialog';
import type { AddDatasetItemDialogProps, CreateDatasetDialogRenderProps } from '../add-dataset-item-dialog';
import {
  addItemAgents,
  createdDatasetItem,
  freshDataset,
  pickableDatasets,
  recordedTrajectory,
  tenantContextDataset,
  toollessAgentDataset,
  untargetedDataset,
  weatherAgentDataset,
} from './fixtures/add-dataset-item';
import { buildListDatasetsResponse } from './fixtures/datasets';
import { Toaster, toast } from '@/lib/toast';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// CodeMirror doesn't run in jsdom: a textarea keeps the editor's value, change and accessible name.
vi.mock('@/ds/components/CodeEditor', () => ({
  CodeEditor: ({
    value,
    onChange,
    placeholder,
    'aria-label': ariaLabel,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    'aria-label'?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={event => onChange?.(event.target.value)}
    />
  ),
}));

afterEach(() => {
  toast.dismiss();
  cleanup();
});

function setupHandlers({
  dataset = untargetedDataset,
  agents = addItemAgents,
}: { dataset?: DatasetRecord; agents?: Record<string, GetAgentResponse> } = {}) {
  const posted = vi.fn<(body: unknown) => void>();
  const postedTo = vi.fn<(datasetId: string) => void>();
  const agentsRequested = vi.fn();
  let datasets = pickableDatasets;

  server.use(
    http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse(datasets))),
    http.post(`${BASE_URL}/api/datasets`, () => {
      datasets = [freshDataset, ...datasets];
      return HttpResponse.json(freshDataset);
    }),
    http.get(`${BASE_URL}/api/datasets/:datasetId`, ({ params }) =>
      HttpResponse.json({ ...dataset, id: String(params.datasetId) }),
    ),
    http.get(`${BASE_URL}/api/agents`, () => {
      agentsRequested();
      return HttpResponse.json(agents);
    }),
    http.post(`${BASE_URL}/api/datasets/:datasetId/items`, async ({ request, params }) => {
      posted(await request.json());
      postedTo(String(params.datasetId));
      return HttpResponse.json(createdDatasetItem);
    }),
  );

  return { posted, postedTo, agentsRequested };
}

type DialogProps = Partial<Omit<AddDatasetItemDialogProps, 'open' | 'onOpenChange'>>;

function ReopenableDialog(props: DialogProps) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen dialog
      </button>
      <AddDatasetItemDialog datasetId="dataset-1" {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** The dataset picker stays disabled until the datasets have loaded. */
async function pickerReady() {
  const picker = await screen.findByRole('combobox', { name: 'Dataset' });
  await waitFor(() => expect(picker.getAttribute('data-disabled')).toBeNull());
  return picker;
}

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
  );

  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </MastraReactProvider>
  );
}

function renderDialog(props: DialogProps = {}) {
  const view = render(<ReopenableDialog {...props} />, { wrapper: Providers });
  return { ...view, rerenderDialog: (next: DialogProps) => view.rerender(<ReopenableDialog {...next} />) };
}

// Stands in for the app's create-dataset dialog: creates through the real mutation hook.
function StubCreateDatasetDialog({ open, onOpenChange, onSuccess }: CreateDatasetDialogRenderProps) {
  const { createDataset } = useDatasetMutations();
  if (!open) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        const created = await createDataset.mutateAsync({ name: freshDataset.name });
        onOpenChange(false);
        onSuccess(created.id);
      }}
    >
      Create Dataset
    </button>
  );
}

const editor = (name: string) => screen.getByRole<HTMLTextAreaElement>('textbox', { name });
const type = (name: string, value: string) => fireEvent.change(editor(name), { target: { value } });
const toggle = (name: string) => fireEvent.click(screen.getByRole('switch', { name }));
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const isOn = (name: string) => screen.getByRole('switch', { name }).getAttribute('aria-checked') === 'true';
const currentStep = () => screen.getByRole('list', { name: /^Step \d of 3$/ }).getAttribute('aria-label');
const isDisabled = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name }).disabled;

/** Walks forward with Next until the given step shows (at most two steps, so a blocked step can't loop). */
const goToStep = (step: 2 | 3) => {
  for (let moves = 0; moves < 2 && currentStep() !== `Step ${step} of 3`; moves++) click('Next');
};

const choose = async (field: string, option: string) => {
  fireEvent.click(screen.getByRole('combobox', { name: field }));
  // Base UI only commits a pick on a real press: pointerdown followed by click.
  const item = await screen.findByRole('option', { name: option });
  fireEvent.pointerDown(item);
  fireEvent.click(item);
  await waitFor(() => expect(screen.getByRole('combobox', { name: field }).textContent).toContain(option));
};

/** Finishes the wizard from wherever it is and returns the posted body. */
const addItem = async (posted: ReturnType<typeof setupHandlers>['posted']) => {
  goToStep(3);
  click('Add item');
  await waitFor(() => expect(posted).toHaveBeenCalledTimes(1));
  return posted.mock.calls.at(-1)?.[0];
};

describe('AddDatasetItemDialog', () => {
  describe('when opened', () => {
    it('starts on the first of three steps with the input and ground truth editors', () => {
      setupHandlers();
      renderDialog();

      expect(screen.getByRole('dialog', { name: 'Input and ground truth' })).not.toBeNull();
      expect(currentStep()).toBe('Step 1 of 3');
      expect(editor('Input JSON').value).toBe('{}');
      expect(editor('Ground truth JSON').value).toBe('');
      expect(screen.queryByRole('textbox', { name: 'Tool mocks JSON' })).toBeNull();
      expect(screen.queryByText('Optional')).toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull();
    });

    it('walks through tool mocks, then context and trajectory with every option off', () => {
      setupHandlers();
      renderDialog();

      click('Next');
      expect(currentStep()).toBe('Step 2 of 3');
      expect(screen.getByRole('dialog', { name: /^Tool mocks/ })).not.toBeNull();
      expect(screen.getByText('Optional')).not.toBeNull();
      expect(editor('Tool mocks JSON').value).toBe('');
      expect(screen.queryByRole('textbox', { name: 'Input JSON' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Back' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();

      click('Next');
      expect(currentStep()).toBe('Step 3 of 3');
      expect(screen.getByRole('dialog', { name: /^Context and trajectory/ })).not.toBeNull();
      expect(screen.getByText('Optional')).not.toBeNull();
      expect(screen.getByText(/leave both off/i)).not.toBeNull();
      expect(isOn('Request context')).toBe(false);
      expect(isOn('Expected trajectory')).toBe(false);
      expect(screen.getByRole('button', { name: 'Add item' })).not.toBeNull();
    });

    it('does not offer a scorer override', () => {
      setupHandlers();
      renderDialog();
      goToStep(3);

      expect(screen.queryByRole('switch', { name: /scorer/i })).toBeNull();
    });
  });

  describe('when going back', () => {
    it('shows the previous step with what was entered', () => {
      setupHandlers();
      renderDialog();

      type('Input JSON', '{"city":"Seattle"}');
      click('Next');
      click('Back');

      expect(currentStep()).toBe('Step 1 of 3');
      expect(editor('Input JSON').value).toBe('{"city":"Seattle"}');
    });
  });

  describe('when the input is not valid JSON', () => {
    it('explains why and stays on the first step', async () => {
      const { posted } = setupHandlers();
      renderDialog();

      type('Input JSON', '{nope');
      click('Next');

      expect(await screen.findByText('Input must be valid JSON')).not.toBeNull();
      expect(currentStep()).toBe('Step 1 of 3');
      expect(posted).not.toHaveBeenCalled();
    });
  });

  describe('when only the input is filled', () => {
    it('posts the input alone', async () => {
      const { posted } = setupHandlers();
      renderDialog();

      type('Input JSON', '{"city":"Seattle"}');

      expect(await addItem(posted)).toEqual({ input: { city: 'Seattle' } });
    });
  });

  describe('when a ground truth is filled', () => {
    it('posts the ground truth with the input', async () => {
      const { posted } = setupHandlers();
      renderDialog();

      type('Ground truth JSON', '{"answer":"rainy"}');

      expect(await addItem(posted)).toMatchObject({ input: {}, groundTruth: { answer: 'rainy' } });
    });
  });

  describe('when tool mocks are written as a JSON array', () => {
    it('posts the mocks exactly as written', async () => {
      const { posted } = setupHandlers({ dataset: weatherAgentDataset });
      renderDialog();

      goToStep(2);
      type(
        'Tool mocks JSON',
        JSON.stringify([
          { toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } },
          { toolName: 'agent-researcher', args: {}, output: { text: 'done' }, matchArgs: 'ignore' },
        ]),
      );

      expect(await addItem(posted)).toMatchObject({
        toolMocks: [
          { toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } },
          { toolName: 'agent-researcher', args: {}, output: { text: 'done' }, matchArgs: 'ignore' },
        ],
      });
    });
  });

  describe('when tool mocks are not a JSON array', () => {
    it('explains why and stays on the tool mocks step', async () => {
      const { posted } = setupHandlers();
      renderDialog();

      goToStep(2);
      type('Tool mocks JSON', '{"toolName":"getWeather"}');
      click('Next');

      expect(await screen.findByText('Tool mocks must be a JSON array')).not.toBeNull();
      expect(currentStep()).toBe('Step 2 of 3');
      expect(posted).not.toHaveBeenCalled();
    });
  });

  describe('when tool mocks are filled then cleared', () => {
    it('omits tool mocks from the request', async () => {
      const { posted } = setupHandlers();
      renderDialog();

      goToStep(2);
      type('Tool mocks JSON', '[{"toolName":"getWeather","args":{},"output":{"temp":52}}]');
      type('Tool mocks JSON', '');
      click('Next');

      expect(currentStep()).toBe('Step 3 of 3');
      expect(await addItem(posted)).not.toHaveProperty('toolMocks');
    });
  });

  describe('when the dataset has no target', () => {
    it('still offers tool mocks without looking up agents', () => {
      const { agentsRequested } = setupHandlers({ dataset: untargetedDataset });
      renderDialog();

      goToStep(2);

      expect(editor('Tool mocks JSON')).not.toBeNull();
      expect(agentsRequested).not.toHaveBeenCalled();
    });
  });

  describe('when the target agent has no tools', () => {
    it('still offers tool mocks, e.g. for sub-agent calls', async () => {
      const { agentsRequested } = setupHandlers({ dataset: toollessAgentDataset });
      renderDialog();

      await waitFor(() => expect(agentsRequested).toHaveBeenCalled());
      goToStep(2);

      expect(editor('Tool mocks JSON')).not.toBeNull();
    });
  });

  describe('when the API rejects the tool mocks', () => {
    it('returns to the tool mocks step and shows the field errors', async () => {
      setupHandlers();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, () =>
          HttpResponse.json(
            { error: 'Validation failed', field: 'toolMocks', errors: [{ path: '/0/output', message: 'Required' }] },
            { status: 400 },
          ),
        ),
      );
      renderDialog();

      goToStep(2);
      type('Tool mocks JSON', '[{"toolName":"getWeather","args":{}}]');
      goToStep(3);
      click('Add item');

      expect(await screen.findByText(/\/0\/output/)).not.toBeNull();
      expect(screen.getByText(/Required/)).not.toBeNull();
      expect(currentStep()).toBe('Step 2 of 3');
    });
  });

  describe('when request context is enabled with JSON', () => {
    it('posts the request context', async () => {
      const { posted } = setupHandlers();
      renderDialog();

      goToStep(3);
      toggle('Request context');
      type('Request context JSON', '{"tenant":"acme"}');

      expect(await addItem(posted)).toMatchObject({ requestContext: { tenant: 'acme' } });
    });
  });

  describe('when the dataset has a request context schema', () => {
    it('suggests the schema keys in the JSON editor', async () => {
      setupHandlers({ dataset: tenantContextDataset });
      renderDialog();

      goToStep(3);
      toggle('Request context');

      await waitFor(() => expect(editor('Request context JSON').placeholder).toContain('"tenant"'));
    });

    it('posts the JSON as written', async () => {
      const { posted } = setupHandlers({ dataset: tenantContextDataset });
      renderDialog();

      goToStep(3);
      toggle('Request context');
      type('Request context JSON', '{"tenant":"acme","plan":"pro"}');

      expect(await addItem(posted)).toMatchObject({ requestContext: { tenant: 'acme', plan: 'pro' } });
    });
  });

  describe('when filled request context is switched off and on again', () => {
    it('posts the value entered before it was switched off', async () => {
      const { posted } = setupHandlers();
      renderDialog();

      goToStep(3);
      toggle('Request context');
      type('Request context JSON', '{"tenant":"acme"}');
      toggle('Request context');
      toggle('Request context');

      expect(await addItem(posted)).toMatchObject({ requestContext: { tenant: 'acme' } });
    });
  });

  describe('when request context is filled and switched off', () => {
    it('omits request context from the request', async () => {
      const { posted } = setupHandlers();
      renderDialog();

      goToStep(3);
      toggle('Request context');
      type('Request context JSON', '{"tenant":"acme"}');
      toggle('Request context');

      expect(await addItem(posted)).not.toHaveProperty('requestContext');
    });
  });

  describe('when the second trajectory step is moved up', () => {
    it('posts the steps in the new order with the ordering mode', async () => {
      const { posted } = setupHandlers();
      renderDialog();

      goToStep(3);
      toggle('Expected trajectory');
      click('Add step');
      click('Add step');
      type('Step 1 name', 'search');
      type('Step 2 name', 'summarize');
      click('Move step 2 up');

      expect(await addItem(posted)).toMatchObject({
        expectedTrajectory: {
          ordering: 'relaxed',
          steps: [
            { stepType: 'tool_call', name: 'summarize' },
            { stepType: 'tool_call', name: 'search' },
          ],
        },
      });
    });
  });

  describe('when a tool step expects args', () => {
    it('posts the expected args with the step', async () => {
      const { posted } = setupHandlers();
      renderDialog();

      goToStep(3);
      toggle('Expected trajectory');
      click('Add step');
      type('Step 1 name', 'search');
      click('Step 1 expected args');
      type('Step 1 expected args JSON', '{"query":"weather"}');

      expect(await addItem(posted)).toMatchObject({
        expectedTrajectory: { steps: [{ stepType: 'tool_call', name: 'search', toolArgs: { query: 'weather' } }] },
      });
    });
  });

  describe('when a trajectory tool step is added for an agent with tools', () => {
    it("posts the step named after the tool picked from the agent's tools", async () => {
      const { posted } = setupHandlers({ dataset: weatherAgentDataset });
      renderDialog();

      goToStep(3);
      toggle('Expected trajectory');
      click('Add step');
      // The name becomes a picker once the target agent's tools have loaded.
      await screen.findByRole('combobox', { name: 'Step 1 name' });
      await choose('Step 1 name', 'getForecast');

      expect(await addItem(posted)).toMatchObject({
        expectedTrajectory: { steps: [{ name: 'getForecast', stepType: 'tool_call' }] },
      });
    });
  });

  describe('when the trajectory is filled and switched off', () => {
    it('omits the expected trajectory from the request', async () => {
      const { posted } = setupHandlers();
      renderDialog();

      goToStep(3);
      toggle('Expected trajectory');
      click('Add step');
      type('Step 1 name', 'search');
      toggle('Expected trajectory');

      expect(await addItem(posted)).not.toHaveProperty('expectedTrajectory');
    });
  });

  describe('when the item is created', () => {
    it('confirms, reports success and closes the dialog', async () => {
      const onSuccess = vi.fn();
      setupHandlers();
      renderDialog({ onSuccess });

      goToStep(3);
      click('Add item');

      expect(await screen.findByText('Item added successfully')).not.toBeNull();
      expect(onSuccess).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });

  describe('when the API rejects the input', () => {
    it('returns to the first step and shows the field errors under the input', async () => {
      setupHandlers();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, () =>
          HttpResponse.json(
            { error: 'Validation failed', field: 'input', errors: [{ path: '/prompt', message: 'Required' }] },
            { status: 400 },
          ),
        ),
      );
      renderDialog();

      goToStep(3);
      click('Add item');

      expect(await screen.findByText(/prompt/)).not.toBeNull();
      expect(screen.getByText(/Required/)).not.toBeNull();
      expect(currentStep()).toBe('Step 1 of 3');
      expect(screen.getByRole('dialog')).not.toBeNull();
    });
  });

  describe('when closed and reopened', () => {
    it('starts over on the first step with a fresh form', async () => {
      setupHandlers();
      renderDialog();

      type('Input JSON', '{"city":"Seattle"}');
      goToStep(3);
      toggle('Request context');
      click('Close');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      click('Reopen dialog');

      expect(await screen.findByRole('dialog')).not.toBeNull();
      expect(currentStep()).toBe('Step 1 of 3');
      expect(editor('Input JSON').value).toBe('{}');
      goToStep(3);
      expect(isOn('Request context')).toBe(false);
    });
  });

  describe('when opened with initial values', () => {
    const initialToolMocks = '[{"toolName":"getWeather","args":{"city":"Seattle"},"output":{"temp":52}}]';
    const renderPrefilled = () =>
      renderDialog({
        initialInput: '{"city":"Seattle"}',
        initialGroundTruth: '{"answer":"rainy"}',
        initialToolMocks,
        initialTrajectory: recordedTrajectory,
      });

    it('fills every step and switches on the prefilled trajectory', () => {
      setupHandlers();
      renderPrefilled();

      expect(editor('Input JSON').value).toBe('{"city":"Seattle"}');
      expect(editor('Ground truth JSON').value).toBe('{"answer":"rainy"}');
      goToStep(2);
      expect(editor('Tool mocks JSON').value).toBe(initialToolMocks);
      goToStep(3);
      expect(isOn('Expected trajectory')).toBe(true);
      expect(editor('Step 1 name').value).toBe('getWeather');
      expect(editor('Step 2 name').value).toBe('gpt-4o-mini');
    });

    it('posts the recorded step details the editor does not show', async () => {
      const { posted } = setupHandlers();
      renderPrefilled();

      expect(await addItem(posted)).toEqual({
        input: { city: 'Seattle' },
        groundTruth: { answer: 'rainy' },
        toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }],
        expectedTrajectory: {
          ordering: 'strict',
          steps: [
            {
              stepType: 'tool_call',
              name: 'getWeather',
              toolArgs: { city: 'Seattle' },
              toolResult: { temp: 52 },
              success: true,
            },
            { stepType: 'model_generation', name: 'gpt-4o-mini', modelId: 'gpt-4o-mini' },
          ],
        },
      });
    });
  });

  describe('when a recorded step changes type', () => {
    it('drops the details recorded for the old type', async () => {
      const { posted } = setupHandlers();
      renderDialog({ initialTrajectory: recordedTrajectory });

      goToStep(3);
      await choose('Step 1 type', 'MCP tool call');

      expect(await addItem(posted)).toMatchObject({
        expectedTrajectory: {
          steps: [
            { stepType: 'mcp_tool_call', name: 'getWeather', toolArgs: { city: 'Seattle' } },
            { stepType: 'model_generation', name: 'gpt-4o-mini', modelId: 'gpt-4o-mini' },
          ],
        },
      });
      expect(posted.mock.calls[0]?.[0]).not.toHaveProperty(['expectedTrajectory', 'steps', 0, 'toolResult']);
    });
  });

  describe('when initial values are still loading', () => {
    it('waits for them before showing the form', async () => {
      setupHandlers();
      const { rerenderDialog } = renderDialog({ initialValuesLoading: true });

      expect(screen.queryByRole('textbox', { name: 'Input JSON' })).toBeNull();
      expect(isDisabled('Next')).toBe(true);

      rerenderDialog({ initialInput: '{"city":"Seattle"}' });

      expect((await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Input JSON' })).value).toBe(
        '{"city":"Seattle"}',
      );
    });
  });

  describe('when a source is given', () => {
    it('tags the item with it', async () => {
      const { posted } = setupHandlers();
      renderDialog({ source: { type: 'trace', referenceId: 'trace-1' } });

      expect(await addItem(posted)).toMatchObject({ source: { type: 'trace', referenceId: 'trace-1' } });
    });
  });

  describe('when no dataset is given', () => {
    it('asks which dataset to add the item to before moving on', async () => {
      const { posted } = setupHandlers();
      renderDialog({ datasetId: undefined });

      expect(await screen.findByRole('combobox', { name: 'Dataset' })).not.toBeNull();
      expect(isDisabled('Next')).toBe(true);
      expect(posted).not.toHaveBeenCalled();
    });

    it('adds the item to the picked dataset and says where it went', async () => {
      const { postedTo } = setupHandlers();
      renderDialog({ datasetId: undefined });

      await pickerReady();
      await choose('Dataset', 'Support QA');
      goToStep(3);
      click('Add item');

      await waitFor(() => expect(postedTo).toHaveBeenCalledWith('dataset-2'));
      expect(await screen.findByText('Added to Support QA')).not.toBeNull();
    });

    it('sets "Create dataset" apart from the datasets', async () => {
      setupHandlers();
      renderDialog({
        datasetId: undefined,
        renderCreateDatasetDialog: props => <StubCreateDatasetDialog {...props} />,
      });

      fireEvent.click(await pickerReady());
      const listbox = await screen.findByRole('listbox');
      const [createOption, firstDataset] = within(listbox).getAllByRole('option');
      const separator = createOption.nextElementSibling;

      expect(createOption.textContent).toBe('Create dataset');
      expect(createOption.querySelector('svg')).not.toBeNull();
      expect(separator?.getAttribute('data-slot')).toBe('select-separator');
      expect(separator?.nextElementSibling).toBe(firstDataset);
    });

    it('picks the dataset created from the picker', async () => {
      const { postedTo } = setupHandlers();
      renderDialog({
        datasetId: undefined,
        renderCreateDatasetDialog: props => <StubCreateDatasetDialog {...props} />,
      });

      const picker = await pickerReady();
      fireEvent.click(picker);
      const createOption = await screen.findByRole('option', { name: 'Create dataset' });
      fireEvent.pointerDown(createOption);
      fireEvent.click(createOption);
      fireEvent.click(await screen.findByRole('button', { name: 'Create Dataset' }));

      await waitFor(() => expect(picker.textContent).toContain(freshDataset.name));
      await waitFor(() => expect(isDisabled('Next')).toBe(false));
      goToStep(3);
      click('Add item');

      await waitFor(() => expect(postedTo).toHaveBeenCalledWith(freshDataset.id));
    });
  });
});
