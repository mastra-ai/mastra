// @vitest-environment jsdom
import type { BuilderSettingsResponse, DatasetRecord, GetScoresScorers_Response } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { datasetVersionsResponse } from '../../__tests__/fixtures/dataset-versions';
import { buildDataset, buildListDatasetsResponse } from '../../__tests__/fixtures/datasets';
import { itemScorers } from '../../__tests__/fixtures/item-scorers';
import {
  lockedModelPolicySettings,
  modelProviders,
  openModelPolicySettings,
} from '../../__tests__/fixtures/model-providers';
import { targetAgents } from '../../__tests__/fixtures/target-agents';
import { ExperimentTriggerDialog } from '../experiment-trigger-dialog';
import type { ExperimentTriggerDialogProps } from '../experiment-trigger-dialog';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

vi.mock('@mastra/playground-ui/components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="Request context JSON" value={value} onChange={event => onChange?.(event.target.value)} />
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Newest first, as the API lists them: the dialog opens on the first one.
const defaultDatasets = [
  buildDataset(),
  buildDataset({
    id: 'dataset-2',
    name: 'Dataset 2',
    requestContextSchema: { type: 'object', properties: { tenant: { type: 'string' } } },
  }),
];

const emptyVersionsResponse = { versions: [], pagination: { total: 0, page: 0, perPage: 10, hasMore: false } };

function setupHandlers({
  datasets = defaultDatasets,
  scorers = {},
  builderSettings = openModelPolicySettings,
}: {
  datasets?: DatasetRecord[];
  scorers?: GetScoresScorers_Response;
  builderSettings?: BuilderSettingsResponse;
} = {}) {
  const triggerCalls: Array<{ datasetId: string; body: Record<string, unknown> }> = [];

  server.use(
    http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse(datasets))),
    http.get(`${BASE_URL}/api/datasets/:datasetId`, ({ params }) => {
      const dataset = datasets.find(d => d.id === params.datasetId);
      return dataset ? HttpResponse.json(dataset) : HttpResponse.json({ error: 'not found' }, { status: 404 });
    }),
    http.get(`${BASE_URL}/api/datasets/:datasetId/items`, () =>
      HttpResponse.json({ items: [], pagination: { total: 3, page: 0, perPage: 50, hasMore: false } }),
    ),
    http.get(`${BASE_URL}/api/datasets/:datasetId/versions`, ({ params }) =>
      HttpResponse.json(params.datasetId === 'dataset-1' ? datasetVersionsResponse : emptyVersionsResponse),
    ),
    http.get(`${BASE_URL}/api/agents`, () => HttpResponse.json(targetAgents)),
    http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json(scorers)),
    http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json(modelProviders)),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(builderSettings)),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
    http.post<{ datasetId: string }, Record<string, unknown>>(
      `${BASE_URL}/api/datasets/:datasetId/experiments`,
      async ({ params, request }) => {
        triggerCalls.push({ datasetId: params.datasetId, body: await request.json() });
        return HttpResponse.json({
          experimentId: 'exp-1',
          status: 'pending',
          totalItems: 0,
          succeededCount: 0,
          failedCount: 0,
          startedAt: new Date().toISOString(),
          completedAt: null,
          results: [],
        });
      },
    ),
  );

  return { triggerCalls };
}

function renderDialog(props: Partial<ExperimentTriggerDialogProps> = {}) {
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const dialog = (open: boolean) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <ExperimentTriggerDialog open={open} onOpenChange={onOpenChange} onSuccess={onSuccess} {...props} />
      </QueryClientProvider>
    </MastraReactProvider>
  );
  const { rerender } = render(dialog(true));

  /** Closes the dialog like its caller would, waits for it to leave, and opens it again. */
  async function reopen() {
    rerender(dialog(false));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    rerender(dialog(true));
  }

  return { onSuccess, onOpenChange, reopen };
}

const targetField = () => screen.getByRole<HTMLInputElement>('combobox', { name: /^Target/ });
const datasetField = () => screen.getByRole<HTMLInputElement>('combobox', { name: /^Dataset(?! version)/ });
const scorersField = () => screen.getByRole<HTMLInputElement>('combobox', { name: /^Scorers/ });
const runButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Run experiment' });
const advancedToggle = () => screen.getByRole('button', { name: 'Advanced' });
const nameInput = () => screen.getByLabelText<HTMLInputElement>('Experiment name');
const descriptionInput = () => screen.getByLabelText<HTMLTextAreaElement>('Description');
const chipLabels = () =>
  Array.from(document.querySelectorAll('[data-slot=combobox-chip]'), chip => chip.textContent?.trim());

/** Opens a combobox field's list and picks the option. */
async function choose(field: HTMLInputElement, option: string) {
  fireEvent.keyDown(field, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

async function pickAgentOne() {
  await waitFor(() => expect(targetField().disabled).toBe(false));
  await choose(targetField(), 'Agent One');
  await waitFor(() => expect(targetField().value).toBe('Agent One'));
}

async function openAdvanced() {
  fireEvent.click(advancedToggle());
  return screen.findByLabelText<HTMLTextAreaElement>('Description');
}

describe('ExperimentTriggerDialog', () => {
  describe('the three fields', () => {
    it('opens on the newest dataset with Run disabled until a target is picked', async () => {
      setupHandlers();
      renderDialog();

      await waitFor(() => expect(datasetField().value).toBe('Dataset 1'));
      expect(await screen.findByText('3 items · latest')).toBeDefined();
      expect(runButton().disabled).toBe(true);

      await pickAgentOne();
      expect(runButton().disabled).toBe(false);
    });

    it('runs the picked target on the picked dataset and reports the experiment id', async () => {
      const { triggerCalls } = setupHandlers();
      const toastSuccess = vi.spyOn(toast, 'success');
      const { onSuccess, onOpenChange } = renderDialog();

      await waitFor(() => expect(datasetField().value).toBe('Dataset 1'));
      await choose(datasetField(), 'Dataset 2');
      await pickAgentOne();
      fireEvent.click(runButton());

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('exp-1'));
      expect(toastSuccess).toHaveBeenCalledWith('Experiment started');
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(triggerCalls).toHaveLength(1);
      expect(triggerCalls[0].datasetId).toBe('dataset-2');
      expect(triggerCalls[0].body).toMatchObject({ targetType: 'agent', targetId: 'agent-1' });
      expect(triggerCalls[0].body.version).toBeUndefined();
      expect(triggerCalls[0].body).not.toHaveProperty('scorerIds');
    });

    it('submits on Ctrl+Enter only once a target is picked', async () => {
      const { triggerCalls } = setupHandlers();
      renderDialog();
      await waitFor(() => expect(datasetField().value).toBe('Dataset 1'));

      fireEvent.keyDown(datasetField(), { key: 'Enter', ctrlKey: true });
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(triggerCalls).toHaveLength(0);

      await pickAgentOne();
      fireEvent.keyDown(targetField(), { key: 'Enter', ctrlKey: true });
      await waitFor(() => expect(triggerCalls).toHaveLength(1));
    });
  });

  describe('when opened from a rerun', () => {
    it('pre-fills target, dataset, version and scorers and sends them', async () => {
      const { triggerCalls } = setupHandlers({ scorers: itemScorers });
      renderDialog({
        initialDatasetId: 'dataset-1',
        initialDatasetVersion: 11,
        initialTargetType: 'agent',
        initialTargetId: 'agent-1',
        initialScorerIds: ['quality'],
      });

      await waitFor(() => expect(targetField().value).toBe('Agent One'));
      expect(datasetField().value).toBe('Dataset 1');
      expect(await screen.findByText('3 items · v11')).toBeDefined();
      await waitFor(() => expect(chipLabels()).toEqual(['Quality scorer']));
      // The pinned version shows in the dataset hint; Advanced stays closed.
      expect(advancedToggle().getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByText('Dataset version')).toBeNull();

      fireEvent.click(runButton());
      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].datasetId).toBe('dataset-1');
      expect(triggerCalls[0].body).toMatchObject({
        targetType: 'agent',
        targetId: 'agent-1',
        version: 11,
        scorerIds: ['quality'],
      });
    });

    it("drops the rerun's scorers when the dataset changes", async () => {
      const { triggerCalls } = setupHandlers({ scorers: itemScorers });
      renderDialog({ initialDatasetId: 'dataset-1', initialScorerIds: ['quality'] });

      await waitFor(() => expect(chipLabels()).toEqual(['Quality scorer']));
      await choose(datasetField(), 'Dataset 2');
      await waitFor(() => expect(chipLabels()).toEqual([]));
      await pickAgentOne();
      fireEvent.click(runButton());

      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].body).not.toHaveProperty('scorerIds');
    });

    it('forgets the pinned version when the dataset changes', async () => {
      const { triggerCalls } = setupHandlers();
      renderDialog({ initialDatasetId: 'dataset-1', initialDatasetVersion: 11 });

      await waitFor(() => expect(datasetField().value).toBe('Dataset 1'));
      await choose(datasetField(), 'Dataset 2');
      await pickAgentOne();
      fireEvent.click(runButton());

      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].datasetId).toBe('dataset-2');
      expect(triggerCalls[0].body.version).toBeUndefined();
    });
  });

  describe('Advanced', () => {
    it('stays closed by default, with its toggle in the body above the footer', async () => {
      setupHandlers();
      renderDialog();
      await waitFor(() => expect(datasetField().value).toBe('Dataset 1'));

      expect(screen.queryByLabelText('Description')).toBeNull();
      expect(advancedToggle().closest('[data-slot=dialog-footer]')).toBeNull();

      await openAdvanced();
      expect(advancedToggle().closest('[data-slot=dialog-footer]')).toBeNull();
      expect(advancedToggle().getAttribute('aria-expanded')).toBe('true');
    });

    it('only offers a dataset version when the dataset has older versions', async () => {
      setupHandlers({
        datasets: [buildDataset({ version: 1 }), buildDataset({ id: 'dataset-2', name: 'Dataset 2', version: 3 })],
      });
      renderDialog();
      await waitFor(() => expect(datasetField().value).toBe('Dataset 1'));
      await openAdvanced();

      expect(screen.queryByText('Dataset version')).toBeNull();
      await choose(datasetField(), 'Dataset 2');
      expect(await screen.findByText('Dataset version')).toBeDefined();
    });
  });

  describe('model override', () => {
    const providerField = () => screen.getByRole('combobox', { name: 'Model provider' });
    const modelField = () => screen.getByRole('combobox', { name: 'Model' });

    /**
     * The model pickers are buttons, not text inputs, so a click opens them. A provider option's name starts
     * with its logo and connection status, so options are matched on how their name ends.
     */
    async function pick(field: HTMLElement, option: string) {
      fireEvent.click(field);
      await pickOpenOption(option);
    }

    async function pickOpenOption(option: string) {
      fireEvent.click(await screen.findByRole('option', { name: name => name.endsWith(option) }));
    }

    /** Picking a provider opens the model list straight away, as in the composer. */
    async function pickModel(provider: string, model: string) {
      await pick(providerField(), provider);
      await pickOpenOption(model);
      await waitFor(() => expect(modelField().textContent).toContain(model));
    }

    async function openModelOverride() {
      await pickAgentOne();
      await screen.findByRole('combobox', { name: 'Model provider' });
    }

    describe('when an agent is the target', () => {
      it("shows the agent's own provider and model without opening Advanced", async () => {
        setupHandlers();
        renderDialog();
        await openModelOverride();

        expect(advancedToggle().getAttribute('aria-expanded')).toBe('false');
        await waitFor(() => expect(providerField().textContent).toContain('OpenAI'));
        expect(modelField().textContent).toContain('gpt-4o-mini');
        expect(screen.queryByRole('button', { name: "Use the agent's model" })).toBeNull();
      });

      it('runs the agent on the picked provider and model', async () => {
        const { triggerCalls } = setupHandlers();
        renderDialog();
        await openModelOverride();

        await pickModel('Anthropic', 'claude-haiku-4-5');
        fireEvent.click(runButton());

        await waitFor(() => expect(triggerCalls).toHaveLength(1));
        expect(triggerCalls[0].body.agentModel).toEqual({ provider: 'anthropic', modelId: 'claude-haiku-4-5' });
      });

      it('names the run after the agent and the picked model, so runs on different models can be told apart', async () => {
        const { triggerCalls } = setupHandlers();
        renderDialog();
        await openModelOverride();

        await pickModel('Anthropic', 'claude-haiku-4-5');

        await waitFor(() => expect(nameInput().placeholder).toMatch(/^agent-one-claude-haiku-4-5-[0-9a-f]{4}$/));
        fireEvent.click(runButton());
        await waitFor(() => expect(triggerCalls).toHaveLength(1));
        expect(triggerCalls[0].body.name).toBe(nameInput().placeholder);
      });

      it("keeps a gateway provider's prefix", async () => {
        const { triggerCalls } = setupHandlers();
        renderDialog();
        await openModelOverride();

        await pickModel('Acme Gateway', 'acme-mini');
        fireEvent.click(runButton());

        await waitFor(() => expect(triggerCalls).toHaveLength(1));
        expect(triggerCalls[0].body.agentModel).toEqual({ provider: 'acme/gateway', modelId: 'acme-mini' });
      });

      it("uses the agent's own model when nothing is picked", async () => {
        const { triggerCalls } = setupHandlers();
        renderDialog();
        await openModelOverride();

        fireEvent.click(runButton());

        await waitFor(() => expect(triggerCalls).toHaveLength(1));
        expect(triggerCalls[0].body).not.toHaveProperty('agentModel');
      });

      it('sends no override when only a provider is picked', async () => {
        const { triggerCalls } = setupHandlers();
        renderDialog();
        await openModelOverride();

        await pick(providerField(), 'Anthropic');
        fireEvent.click(runButton());

        await waitFor(() => expect(triggerCalls).toHaveLength(1));
        expect(triggerCalls[0].body).not.toHaveProperty('agentModel');
      });

      it("drops the picked model when the provider changes, so it never pairs with another provider's model", async () => {
        const { triggerCalls } = setupHandlers();
        renderDialog();
        await openModelOverride();

        await pickModel('OpenAI', 'gpt-4o');
        await pick(providerField(), 'Anthropic');
        fireEvent.click(runButton());

        await waitFor(() => expect(triggerCalls).toHaveLength(1));
        expect(triggerCalls[0].body).not.toHaveProperty('agentModel');
      });

      it("goes back to the agent's own model on reset", async () => {
        const { triggerCalls } = setupHandlers();
        renderDialog();
        await openModelOverride();

        await pickModel('OpenAI', 'gpt-4o');
        fireEvent.click(screen.getByRole('button', { name: "Use the agent's model" }));
        await waitFor(() => expect(modelField().textContent).toContain('gpt-4o-mini'));
        fireEvent.click(runButton());

        await waitFor(() => expect(triggerCalls).toHaveLength(1));
        expect(triggerCalls[0].body).not.toHaveProperty('agentModel');
      });

      it("sends no override when the agent's own model is picked back", async () => {
        const { triggerCalls } = setupHandlers();
        renderDialog();
        await openModelOverride();

        await pickModel('Anthropic', 'claude-haiku-4-5');
        await pickModel('OpenAI', 'gpt-4o-mini');
        expect(screen.queryByRole('button', { name: "Use the agent's model" })).toBeNull();
        fireEvent.click(runButton());

        await waitFor(() => expect(triggerCalls).toHaveLength(1));
        expect(triggerCalls[0].body).not.toHaveProperty('agentModel');
        expect(triggerCalls[0].body.name).toMatch(/^agent-one-[0-9a-f]{4}$/);
      });

      it("drops the picked model when another agent is picked, so it runs on that agent's own model", async () => {
        const { triggerCalls } = setupHandlers();
        renderDialog();
        await openModelOverride();

        await pickModel('Anthropic', 'claude-haiku-4-5');
        await choose(targetField(), 'Agent Two');
        await waitFor(() => expect(providerField().textContent).toContain('OpenAI'));
        expect(modelField().textContent).toContain('gpt-4o-mini');
        fireEvent.click(runButton());

        await waitFor(() => expect(triggerCalls).toHaveLength(1));
        expect(triggerCalls[0].body).toMatchObject({ targetType: 'agent', targetId: 'agent-2' });
        expect(triggerCalls[0].body).not.toHaveProperty('agentModel');
      });
    });

    describe('when the target is not an agent', () => {
      it('offers no model and sends none', async () => {
        const { triggerCalls } = setupHandlers({ scorers: itemScorers });
        renderDialog();
        await openModelOverride();
        await pickModel('OpenAI', 'gpt-4o');

        await choose(targetField(), 'Quality scorer');
        await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Model provider' })).toBeNull());
        fireEvent.click(runButton());

        await waitFor(() => expect(triggerCalls).toHaveLength(1));
        expect(triggerCalls[0].body).toMatchObject({ targetType: 'scorer', targetId: 'quality' });
        expect(triggerCalls[0].body).not.toHaveProperty('agentModel');
        expect(triggerCalls[0].body.name).toMatch(/^quality-scorer-[0-9a-f]{4}$/);
      });
    });

    describe('when an admin has hidden the model picker', () => {
      it('shows the model as locked and sends no override', async () => {
        const { triggerCalls } = setupHandlers({ builderSettings: lockedModelPolicySettings });
        renderDialog();
        await pickAgentOne();

        expect(await screen.findByText('Locked by admin')).toBeDefined();
        expect(screen.queryByRole('combobox', { name: 'Model provider' })).toBeNull();
        fireEvent.click(runButton());

        await waitFor(() => expect(triggerCalls).toHaveLength(1));
        expect(triggerCalls[0].body).not.toHaveProperty('agentModel');
      });
    });
  });

  describe('when reopened', () => {
    it('starts from a fresh form', async () => {
      setupHandlers();
      const { reopen } = renderDialog();
      await pickAgentOne();
      await openAdvanced();
      fireEvent.change(nameInput(), { target: { value: 'Prompt v2' } });

      await reopen();

      await waitFor(() => expect(datasetField().value).toBe('Dataset 1'));
      expect(targetField().value).toBe('');
      expect(nameInput().value).toBe('');
      expect(screen.queryByLabelText('Description')).toBeNull();
    });
  });

  describe('experiment name and description', () => {
    it('shows the name first, above the target, without opening Advanced', async () => {
      setupHandlers();
      renderDialog();
      await waitFor(() => expect(datasetField().value).toBe('Dataset 1'));

      expect(advancedToggle().getAttribute('aria-expanded')).toBe('false');
      expect(nameInput().compareDocumentPosition(targetField()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('shows the target name plus a short id as the placeholder and runs with it', async () => {
      const { triggerCalls } = setupHandlers();
      renderDialog();
      await pickAgentOne();

      expect(nameInput().value).toBe('');
      expect(nameInput().placeholder).toMatch(/^agent-one-[0-9a-f]{4}$/);

      fireEvent.click(runButton());
      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].body.name).toBe(nameInput().placeholder);
    });

    it('follows the target until a name is typed', async () => {
      setupHandlers();
      renderDialog();
      await pickAgentOne();
      const suffix = nameInput().placeholder.slice(-4);

      await choose(targetField(), 'Agent Two');
      await waitFor(() => expect(nameInput().placeholder).toBe(`agent-two-${suffix}`));
    });

    it('names the run after the target id when the target has no display name', async () => {
      setupHandlers();
      renderDialog();
      await waitFor(() => expect(targetField().disabled).toBe(false));
      await choose(targetField(), 'agent-unnamed');

      expect(nameInput().placeholder).toMatch(/^agent-unnamed-[0-9a-f]{4}$/);
    });

    it('sends a typed name and description, and omits a blank description', async () => {
      const { triggerCalls } = setupHandlers();
      renderDialog();
      await pickAgentOne();
      await openAdvanced();

      fireEvent.change(nameInput(), { target: { value: 'Prompt v2' } });
      fireEvent.change(descriptionInput(), { target: { value: '  ' } });
      fireEvent.click(runButton());
      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].body.name).toBe('Prompt v2');
      expect(triggerCalls[0].body).not.toHaveProperty('description');
    });

    it('pre-fills name, and description behind a closed Advanced, from a rerun', async () => {
      const { triggerCalls } = setupHandlers();
      renderDialog({ initialName: 'Baseline', initialDescription: 'First pass' });

      await waitFor(() => expect(datasetField().value).toBe('Dataset 1'));
      expect(nameInput().value).toBe('Baseline');
      expect(advancedToggle().getAttribute('aria-expanded')).toBe('false');
      await openAdvanced();
      expect(descriptionInput().value).toBe('First pass');

      await pickAgentOne();
      fireEvent.click(runButton());
      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].body).toMatchObject({ name: 'Baseline', description: 'First pass' });
    });
  });

  describe('request context', () => {
    it('uses a JSON editor and rejects JSON that is not an object', async () => {
      const { triggerCalls } = setupHandlers();
      const toastError = vi.spyOn(toast, 'error');
      renderDialog();
      await pickAgentOne();
      await openAdvanced();

      fireEvent.change(screen.getByLabelText('Request context JSON'), { target: { value: '[1, 2]' } });
      fireEvent.click(runButton());

      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Request context must be a JSON object'));
      expect(triggerCalls).toHaveLength(0);
    });

    it('sends parsed JSON', async () => {
      const { triggerCalls } = setupHandlers();
      renderDialog();
      await pickAgentOne();
      await openAdvanced();

      fireEvent.change(screen.getByLabelText('Request context JSON'), { target: { value: '{"userId":"u1"}' } });
      fireEvent.click(runButton());

      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].body.requestContext).toEqual({ userId: 'u1' });
    });

    it('switches to a form when the dataset has a request context schema', async () => {
      setupHandlers();
      renderDialog();
      await waitFor(() => expect(datasetField().value).toBe('Dataset 1'));
      await openAdvanced();
      expect(screen.getByLabelText('Request context JSON')).toBeDefined();

      await choose(datasetField(), 'Dataset 2');
      expect(await screen.findByText('Request context')).toBeDefined();
      expect(screen.queryByLabelText('Request context JSON')).toBeNull();
    });
  });

  describe('scorers', () => {
    const datasetsWithDefaults = [
      buildDataset({ id: 'dataset-1', name: 'Dataset 1', scorerIds: ['quality'] }),
      buildDataset({ id: 'dataset-2', name: 'Dataset 2', scorerIds: ['stored-judge'] }),
      buildDataset({ id: 'dataset-3', name: 'Dataset 3' }),
    ];

    it("starts on the dataset's default scorers and says so", async () => {
      const { triggerCalls } = setupHandlers({ datasets: datasetsWithDefaults, scorers: itemScorers });
      renderDialog();

      await waitFor(() => expect(chipLabels()).toEqual(['Quality scorer']));
      expect(screen.getByText("The dataset's default scorers.")).toBeDefined();

      await pickAgentOne();
      fireEvent.click(runButton());
      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].body.scorerIds).toEqual(['quality']);
    });

    it('shows a chip for a default scorer the list does not offer, and sends it', async () => {
      const { triggerCalls } = setupHandlers({
        datasets: [buildDataset({ scorerIds: ['retired-scorer'] })],
        scorers: itemScorers,
      });
      renderDialog();

      await waitFor(() => expect(chipLabels()).toEqual(['retired-scorer']));
      await pickAgentOne();
      fireEvent.click(runButton());
      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].body.scorerIds).toEqual(['retired-scorer']);
    });

    it('sends no scorers once the defaults are removed', async () => {
      const { triggerCalls } = setupHandlers({ datasets: datasetsWithDefaults, scorers: itemScorers });
      renderDialog();
      await waitFor(() => expect(chipLabels()).toEqual(['Quality scorer']));

      const chip = document.querySelector<HTMLElement>('[data-slot=combobox-chip]')!;
      fireEvent.click(within(chip).getByRole('button'));
      await waitFor(() => expect(chipLabels()).toEqual([]));

      await pickAgentOne();
      fireEvent.click(runButton());
      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].body).not.toHaveProperty('scorerIds');
    });

    it('adds a scorer picked from the list', async () => {
      const { triggerCalls } = setupHandlers({ scorers: itemScorers });
      renderDialog();
      await waitFor(() => expect(datasetField().value).toBe('Dataset 1'));

      await choose(scorersField(), 'Stored judge');
      await waitFor(() => expect(chipLabels()).toEqual(['Stored judge']));
      // A multi-select stays open for more picks; close it like a user would.
      fireEvent.keyDown(scorersField(), { key: 'Escape' });

      await pickAgentOne();
      fireEvent.click(runButton());
      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].body.scorerIds).toEqual(['stored-judge']);
    });

    it("re-applies the new dataset's defaults when the dataset changes", async () => {
      setupHandlers({ datasets: datasetsWithDefaults, scorers: itemScorers });
      renderDialog();
      await waitFor(() => expect(chipLabels()).toEqual(['Quality scorer']));

      await choose(datasetField(), 'Dataset 2');
      await waitFor(() => expect(chipLabels()).toEqual(['Stored judge']));

      await choose(datasetField(), 'Dataset 3');
      await waitFor(() => expect(chipLabels()).toEqual([]));
    });

    it("keeps a rerun's scorers instead of the dataset defaults", async () => {
      const { triggerCalls } = setupHandlers({ datasets: datasetsWithDefaults, scorers: itemScorers });
      renderDialog({ initialDatasetId: 'dataset-1', initialScorerIds: ['stored-judge'] });

      await waitFor(() => expect(chipLabels()).toEqual(['Stored judge']));
      await pickAgentOne();
      fireEvent.click(runButton());
      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].body.scorerIds).toEqual(['stored-judge']);
    });
  });
});
