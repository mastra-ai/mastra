// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DatasetDetailView } from '../dataset-detail-view';
import {
  emptyAgentVersionsResponse,
  emptyDatasetVersionsResponse,
  oneItemResponse,
} from './fixtures/dataset-detail-view';
import {
  emptyScorers,
  supportAgent,
} from '@/domains/datasets/components/experiment-trigger/__tests__/fixtures/trigger-targets';
import {
  listExperimentsResponse,
  liveExperiment,
  triggerExperimentResponse,
} from '@/domains/experiments/__tests__/fixtures/tool-replay';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

beforeAll(() => {
  // Base UI option selection dispatches pointer events jsdom does not implement.
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
  // useDatasetItems' infinite scroll sentinel observes the end-of-list node.
  if (typeof globalThis.IntersectionObserver === 'undefined') {
    class IntersectionObserverPolyfill {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    globalThis.IntersectionObserver = IntersectionObserverPolyfill as unknown as typeof IntersectionObserver;
  }
});

afterEach(cleanup);

/** Registers every GET the side panel fires, plus the POST capture. */
function useDetailViewHandlers() {
  const capture = vi.fn();
  server.use(
    http.get(`${BASE_URL}/api/datasets/dataset-1/items`, () => HttpResponse.json(oneItemResponse)),
    http.get(`${BASE_URL}/api/datasets/dataset-1/experiments`, () =>
      HttpResponse.json(listExperimentsResponse([liveExperiment])),
    ),
    http.get(`${BASE_URL}/api/datasets/dataset-1/versions`, () => HttpResponse.json(emptyDatasetVersionsResponse)),
    http.get(`${BASE_URL}/api/stored/agents/support-agent/versions`, () =>
      HttpResponse.json(emptyAgentVersionsResponse),
    ),
    http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json(emptyScorers)),
    http.get(`${BASE_URL}/api/agents/support-agent`, () => HttpResponse.json(supportAgent)),
    http.post(`${BASE_URL}/api/datasets/dataset-1/experiments`, async ({ request }) => {
      capture(await request.json());
      return HttpResponse.json(triggerExperimentResponse);
    }),
  );
  return capture;
}

function renderDetailView(props?: Partial<Parameters<typeof DatasetDetailView>[0]>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <DatasetDetailView
          agentId="support-agent"
          datasetId="dataset-1"
          datasetName="Support tickets"
          onGenerate={vi.fn()}
          onViewExperiment={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function runButton() {
  return screen.getByRole('button', { name: /run experiment/i }) as HTMLButtonElement;
}

async function waitForItemsLoaded() {
  await waitFor(() => expect(runButton().disabled).toBe(false));
}

describe('DatasetDetailView tool mocks', () => {
  it('sends toolMocks on a mock-only run and omits toolReplay', async () => {
    const capture = useDetailViewHandlers();
    renderDetailView();
    await waitForItemsLoaded();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock' }));
    fireEvent.change(screen.getByLabelText('Tool name'), { target: { value: 'weatherInfo' } });
    fireEvent.change(screen.getByLabelText('Stub output (JSON or plain text)'), {
      target: { value: '{"temp": 20}' },
    });

    fireEvent.click(runButton());

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    const body = capture.mock.calls[0][0] as Record<string, unknown>;
    expect(body.targetType).toBe('agent');
    expect(body.targetId).toBe('support-agent');
    expect(body.toolMocks).toEqual({ weatherInfo: { output: { temp: 20 } } });
    expect('toolReplay' in body).toBe(false);
  });

  it('sends toolReplay and toolMocks together on a combined run', async () => {
    const capture = useDetailViewHandlers();
    renderDetailView();
    await waitForItemsLoaded();

    fireEvent.click(screen.getByRole('switch', { name: 'Replay tools from a previous experiment' }));
    const sourceTrigger = await waitFor(() => {
      const trigger = screen
        .getAllByRole('combobox')
        .find(combo => /select a recording source/i.test(combo.textContent ?? ''));
      if (!trigger) throw new Error('source combobox not found');
      return trigger;
    });
    fireEvent.click(sourceTrigger);
    const sourceOption = await screen.findByRole('option', { name: /baseline/ });
    fireEvent.pointerDown(sourceOption, { pointerType: 'mouse' });
    fireEvent.click(sourceOption, { detail: 1 });

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock' }));
    fireEvent.change(screen.getByLabelText('Tool name'), { target: { value: 'sendEmail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Inject error' }));
    fireEvent.change(screen.getByLabelText('Error message'), { target: { value: 'mail service down' } });

    fireEvent.click(runButton());

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    const body = capture.mock.calls[0][0] as Record<string, unknown>;
    expect(body.toolReplay).toEqual({ fromExperimentId: 'exp-live-1', onMiss: 'error' });
    expect(body.toolMocks).toEqual({ sendEmail: { error: { message: 'mail service down' } } });
  });

  it('sends neither key when mocks and replay stay off', async () => {
    const capture = useDetailViewHandlers();
    renderDetailView();
    await waitForItemsLoaded();

    fireEvent.click(runButton());

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    const body = capture.mock.calls[0][0] as Record<string, unknown>;
    expect('toolReplay' in body).toBe(false);
    expect('toolMocks' in body).toBe(false);
  });

  it('disables Run Experiment while a mock row is invalid', async () => {
    useDetailViewHandlers();
    renderDetailView();
    await waitForItemsLoaded();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock' }));
    const nameInputs = screen.getAllByLabelText('Tool name');
    fireEvent.change(nameInputs[0], { target: { value: 'weatherInfo' } });
    fireEvent.change(nameInputs[1], { target: { value: 'weatherInfo' } });
    const outputs = screen.getAllByLabelText('Stub output (JSON or plain text)');
    fireEvent.change(outputs[0], { target: { value: '"a"' } });
    fireEvent.change(outputs[1], { target: { value: '"b"' } });

    expect(screen.getByText('Duplicate tool name — "weatherInfo" already has a mock.')).toBeDefined();
    expect(runButton().disabled).toBe(true);

    fireEvent.change(nameInputs[1], { target: { value: 'sendEmail' } });
    expect(runButton().disabled).toBe(false);
  });

  it('offers the agent tools as suggestions sourced from the agent details', async () => {
    useDetailViewHandlers();
    renderDetailView();
    await waitForItemsLoaded();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock' }));

    await waitFor(() => {
      const listId = screen.getByLabelText('Tool name').getAttribute('list');
      expect(listId).toBeTruthy();
      const options = Array.from(document.getElementById(listId!)?.querySelectorAll('option') ?? []);
      expect(options.map(option => option.value)).toEqual(['weatherInfo', 'sendEmail', 'chargeCard']);
    });
  });

  it('hides tool mocks (and replay) for non-agent dataset targets', async () => {
    useDetailViewHandlers();
    renderDetailView({ datasetTargetType: 'workflow', datasetTargetIds: ['support-workflow'] });
    await waitForItemsLoaded();

    expect(screen.queryByRole('switch', { name: 'Mock tools' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Replay tools from a previous experiment' })).toBeNull();
  });
});
