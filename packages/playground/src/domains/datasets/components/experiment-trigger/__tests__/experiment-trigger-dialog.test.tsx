// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ExperimentTriggerDialog } from '../experiment-trigger-dialog';
import { agentsWithTools, emptyScorers, emptyWorkflows } from './fixtures/trigger-targets';
import {
  listExperimentsResponse,
  liveExperiment,
  triggerExperimentResponse,
} from '@/domains/experiments/__tests__/fixtures/tool-replay';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// File-scoped: the first dialog render (target selector + combobox portals)
// can exceed the 5s default under a parallel full-suite run.
vi.setConfig({ testTimeout: 15_000 });

beforeAll(() => {
  // Base UI option selection dispatches pointer events jsdom does not implement.
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(cleanup);

/** Registers every GET the open dialog fires, plus the POST capture. */
function useTriggerHandlers() {
  const capture = vi.fn();
  server.use(
    http.get(`${BASE_URL}/api/agents`, () => HttpResponse.json(agentsWithTools)),
    http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json(emptyWorkflows)),
    http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json(emptyScorers)),
    http.get(`${BASE_URL}/api/datasets/dataset-1/experiments`, () =>
      HttpResponse.json(listExperimentsResponse([liveExperiment])),
    ),
    http.post(`${BASE_URL}/api/datasets/dataset-1/experiments`, async ({ request }) => {
      capture(await request.json());
      return HttpResponse.json(triggerExperimentResponse);
    }),
  );
  return capture;
}

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <ExperimentTriggerDialog datasetId="dataset-1" open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

/**
 * Finds a Combobox trigger by its visible text. The combobox role computes
 * its accessible name from author only (never contents), so role+name
 * queries cannot see the placeholder.
 */
function getComboboxByText(text: RegExp): HTMLElement {
  const trigger = screen.getAllByRole('combobox').find(combo => text.test(combo.textContent ?? ''));
  if (!trigger) throw new Error(`No combobox showing ${text}`);
  return trigger;
}

async function selectOption(comboboxText: RegExp, optionName: RegExp | string) {
  fireEvent.click(getComboboxByText(comboboxText));
  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
}

async function selectAgentTarget() {
  await selectOption(/select target type/i, 'Agent');
  await waitFor(() => expect(getComboboxByText(/select agent/i)).toBeDefined());
  await selectOption(/select agent/i, 'Support Agent');
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Mock tools' })).toBeDefined());
}

function runButton() {
  return screen.getByRole('button', { name: 'Run' }) as HTMLButtonElement;
}

function addMockRow() {
  fireEvent.click(screen.getByRole('button', { name: 'Add mock' }));
}

describe('ExperimentTriggerDialog tool mocks', () => {
  it('sends toolMocks exactly on a mock-only run — stub parsed, error shaped, calledTimes 0 kept — and omits toolReplay', async () => {
    const capture = useTriggerHandlers();
    renderDialog();
    await selectAgentTarget();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));

    // Row 1: stub output with JSON.
    addMockRow();
    fireEvent.change(screen.getAllByLabelText('Tool name')[0], { target: { value: 'weatherInfo' } });
    fireEvent.change(screen.getByLabelText('Stub output (JSON or plain text)'), {
      target: { value: '{"temp": 20, "unit": "C"}' },
    });

    // Row 2: injected error with a name.
    addMockRow();
    fireEvent.change(screen.getAllByLabelText('Tool name')[1], { target: { value: 'sendEmail' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Inject error' })[1]);
    fireEvent.change(screen.getByLabelText('Error message'), { target: { value: 'mail service down' } });
    fireEvent.change(screen.getByLabelText('Error name (optional)'), { target: { value: 'MailError' } });

    // Row 3: expect-only, must not be called.
    addMockRow();
    fireEvent.change(screen.getAllByLabelText('Tool name')[2], { target: { value: 'chargeCard' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Expect only' })[2]);
    fireEvent.change(screen.getByLabelText('Expected call count (calledTimes)'), { target: { value: '0' } });

    expect(runButton().disabled).toBe(false);
    fireEvent.click(runButton());

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    const body = capture.mock.calls[0][0] as Record<string, unknown>;
    expect(body.targetType).toBe('agent');
    expect(body.targetId).toBe('support-agent');
    expect(body.toolMocks).toEqual({
      weatherInfo: { output: { temp: 20, unit: 'C' } },
      sendEmail: { error: { name: 'MailError', message: 'mail service down' } },
      chargeCard: { expect: { calledTimes: 0 } },
    });
    expect(body.toolReplay).toBeUndefined();
  });

  it('sends toolReplay and toolMocks together on a combined run', async () => {
    const capture = useTriggerHandlers();
    renderDialog();
    await selectAgentTarget();

    // Enable replay from the prior live experiment.
    fireEvent.click(screen.getByRole('switch', { name: 'Replay tools from a previous experiment' }));
    await selectOption(/select a recording source/i, /baseline/);

    // And mock one tool on top.
    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    addMockRow();
    fireEvent.change(screen.getByLabelText('Tool name'), { target: { value: 'weatherInfo' } });
    fireEvent.change(screen.getByLabelText('Stub output (JSON or plain text)'), { target: { value: 'sunny' } });

    fireEvent.click(runButton());

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    const body = capture.mock.calls[0][0] as Record<string, unknown>;
    expect(body.toolReplay).toEqual({ fromExperimentId: 'exp-live-1', onMiss: 'error' });
    expect(body.toolMocks).toEqual({ weatherInfo: { output: 'sunny' } });
  });

  it('sends neither toolReplay nor toolMocks when both stay disabled', async () => {
    const capture = useTriggerHandlers();
    renderDialog();
    await selectAgentTarget();

    fireEvent.click(runButton());

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    const body = capture.mock.calls[0][0] as Record<string, unknown>;
    expect('toolReplay' in body).toBe(false);
    expect('toolMocks' in body).toBe(false);
  });

  it('keeps enabled-but-empty mocks out of the payload', async () => {
    const capture = useTriggerHandlers();
    renderDialog();
    await selectAgentTarget();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    expect(runButton().disabled).toBe(false);
    fireEvent.click(runButton());

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect('toolMocks' in (capture.mock.calls[0][0] as Record<string, unknown>)).toBe(false);
  });

  it('sends a cases mock byte-exact — Paris answers, Tokyo throws, default onNoMatch stays off the wire', async () => {
    const capture = useTriggerHandlers();
    renderDialog();
    await selectAgentTarget();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    addMockRow();
    fireEvent.change(screen.getByLabelText('Tool name'), { target: { value: 'weatherInfo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conditional cases' }));

    // Case 1: Paris answers with an output.
    fireEvent.click(screen.getByRole('button', { name: 'Add case' }));
    fireEvent.change(screen.getByLabelText('Case 1 args (JSON)'), { target: { value: '{"city": "Paris"}' } });
    fireEvent.change(screen.getByLabelText('Case 1 output (JSON or plain text)'), {
      target: { value: '{"temp": 20}' },
    });

    // Case 2: Tokyo throws.
    fireEvent.click(screen.getByRole('button', { name: 'Add case' }));
    fireEvent.change(screen.getByLabelText('Case 2 args (JSON)'), { target: { value: '{"city": "Tokyo"}' } });
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Case 2 answer kind' })).getByRole('button', { name: 'Error' }),
    );
    fireEvent.change(screen.getByLabelText('Case 2 error message'), { target: { value: 'city offline' } });

    expect(runButton().disabled).toBe(false);
    fireEvent.click(runButton());

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    const body = capture.mock.calls[0][0] as Record<string, unknown>;
    expect(body.toolMocks).toEqual({
      weatherInfo: {
        cases: [
          { args: { city: 'Paris' }, output: { temp: 20 } },
          { args: { city: 'Tokyo' }, error: { message: 'city offline' } },
        ],
      },
    });
    expect(body.toolReplay).toBeUndefined();
  });

  it('sends onNoMatch when Run live is chosen for unmatched calls', async () => {
    const capture = useTriggerHandlers();
    renderDialog();
    await selectAgentTarget();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    addMockRow();
    fireEvent.change(screen.getByLabelText('Tool name'), { target: { value: 'weatherInfo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conditional cases' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add case' }));
    fireEvent.change(screen.getByLabelText('Case 1 args (JSON)'), { target: { value: '{"city": "Paris"}' } });
    fireEvent.change(screen.getByLabelText('Case 1 output (JSON or plain text)'), { target: { value: 'sunny' } });
    fireEvent.click(
      within(screen.getByRole('group', { name: 'If no case matches' })).getByRole('button', { name: 'Run live' }),
    );

    fireEvent.click(runButton());

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect((capture.mock.calls[0][0] as Record<string, unknown>).toolMocks).toEqual({
      weatherInfo: { cases: [{ args: { city: 'Paris' }, output: 'sunny' }], onNoMatch: 'passthrough' },
    });
  });

  it('disables Run while a cases row is incomplete and re-enables once every case is answerable', async () => {
    useTriggerHandlers();
    renderDialog();
    await selectAgentTarget();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    addMockRow();
    fireEvent.change(screen.getByLabelText('Tool name'), { target: { value: 'weatherInfo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conditional cases' }));

    // Empty cases list blocks Run.
    expect(screen.getByText('Add at least one case.')).toBeDefined();
    expect(runButton().disabled).toBe(true);

    // A case without args still blocks.
    fireEvent.click(screen.getByRole('button', { name: 'Add case' }));
    expect(screen.getByText('Case 1: args are required.')).toBeDefined();
    expect(runButton().disabled).toBe(true);

    // JSON-looking-but-broken args still block.
    fireEvent.change(screen.getByLabelText('Case 1 args (JSON)'), { target: { value: '{"city": ' } });
    expect(screen.getByText('Case 1: args is not valid JSON.')).toBeDefined();
    expect(runButton().disabled).toBe(true);

    // Valid args but no answer still block.
    fireEvent.change(screen.getByLabelText('Case 1 args (JSON)'), { target: { value: '{"city": "Paris"}' } });
    expect(screen.getByText('Case 1: output is required.')).toBeDefined();
    expect(runButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Case 1 output (JSON or plain text)'), { target: { value: '"sunny"' } });
    expect(runButton().disabled).toBe(false);
  });

  it('disables Run with an inline hint while a stub output is JSON-looking but invalid', async () => {
    useTriggerHandlers();
    renderDialog();
    await selectAgentTarget();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    addMockRow();
    fireEvent.change(screen.getByLabelText('Tool name'), { target: { value: 'weatherInfo' } });
    fireEvent.change(screen.getByLabelText('Stub output (JSON or plain text)'), { target: { value: '{"temp": ' } });

    expect(screen.getByText(/Invalid JSON/)).toBeDefined();
    expect(runButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Stub output (JSON or plain text)'), { target: { value: '{"temp": 20}' } });
    expect(screen.queryByText(/Invalid JSON/)).toBeNull();
    expect(runButton().disabled).toBe(false);
  });

  it('disables Run while two rows mock the same tool', async () => {
    useTriggerHandlers();
    renderDialog();
    await selectAgentTarget();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    addMockRow();
    addMockRow();
    const nameInputs = screen.getAllByLabelText('Tool name');
    fireEvent.change(nameInputs[0], { target: { value: 'weatherInfo' } });
    fireEvent.change(nameInputs[1], { target: { value: 'weatherInfo' } });
    const outputs = screen.getAllByLabelText('Stub output (JSON or plain text)');
    fireEvent.change(outputs[0], { target: { value: '"a"' } });
    fireEvent.change(outputs[1], { target: { value: '"b"' } });

    expect(screen.getByText('Duplicate tool name — "weatherInfo" already has a mock.')).toBeDefined();
    expect(runButton().disabled).toBe(true);
  });

  it('disables Run while an error row has no message', async () => {
    useTriggerHandlers();
    renderDialog();
    await selectAgentTarget();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    addMockRow();
    fireEvent.change(screen.getByLabelText('Tool name'), { target: { value: 'sendEmail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Inject error' }));

    expect(screen.getByText('Error message is required.')).toBeDefined();
    expect(runButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Error message'), { target: { value: 'boom' } });
    expect(runButton().disabled).toBe(false);
  });

  it('suggests the selected agent tools in the tool name datalist', async () => {
    useTriggerHandlers();
    renderDialog();
    await selectAgentTarget();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    addMockRow();

    const listId = screen.getByLabelText('Tool name').getAttribute('list');
    expect(listId).toBeTruthy();
    const options = Array.from(document.getElementById(listId!)?.querySelectorAll('option') ?? []);
    expect(options.map(option => option.value)).toEqual(['weatherInfo', 'sendEmail', 'chargeCard']);
  });

  it('never offers tool mocks (or replay) for workflow targets', async () => {
    useTriggerHandlers();
    renderDialog();

    await selectOption(/select target type/i, 'Workflow');

    await waitFor(() => expect(getComboboxByText(/select workflow/i)).toBeDefined());
    expect(screen.queryByRole('switch', { name: 'Mock tools' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Replay tools from a previous experiment' })).toBeNull();
  });
});
