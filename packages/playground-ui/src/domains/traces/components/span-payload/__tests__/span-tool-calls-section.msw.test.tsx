// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpanRecord } from '../../../types';
import { SpanDataPanelView } from '../../span-data-panel-view';
import { SpanDetailsView } from '../../span-details-view';
import {
  noToolCallsGenerationSpan,
  TOOL_CALLS_TRACE_ID,
  toolCallsGenerationSpan,
  toolCallsStepSpan,
  toolCallsTrace,
} from './fixtures/span-tool-calls';
import { registeredTools } from './fixtures/tools';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// jsdom does not provide PointerEvent, which Base UI switches dispatch.
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(toolCallsTrace)),
    http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
    http.get(`${TEST_BASE_URL}/api/tools`, () => HttpResponse.json(registeredTools)),
  );
});

const LAYOUTS = [
  [
    'data panel',
    (span: SpanRecord) => <SpanDataPanelView traceId={TOOL_CALLS_TRACE_ID} spanId={span.spanId} span={span} />,
  ],
  ['details', (span: SpanRecord) => <SpanDetailsView traceId={TOOL_CALLS_TRACE_ID} spanId={span.spanId} span={span} />],
] as const;

const toolCallsSection = () => {
  const found = document.querySelector('[data-slot="span-tool-calls"]')?.closest('[data-slot="span-payload-section"]');
  if (!(found instanceof HTMLElement)) throw new Error('Missing Tool calls section');
  return found;
};

describe('Tool calls in the data panel', () => {
  it('sit in the summary under its sentence, not in a section of their own', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <SpanDataPanelView traceId={TOOL_CALLS_TRACE_ID} spanId="generation" span={toolCallsGenerationSpan} />
      </TestLinkProvider>,
    );
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    const outcome = document.querySelector('[data-slot="span-outcome"]');
    if (!(outcome instanceof HTMLElement)) throw new Error('Missing span outcome');
    expect(within(outcome).getByRole('heading').textContent).toMatch(/^gpt-5-mini called .*, then wrote the answer$/);
    expect(outcome.contains(toolCallsSection())).toBe(true);
    expect(screen.queryByText(/^Tool calls/)).toBeNull();
    expect(document.querySelectorAll('[data-slot="span-tool-calls"]')).toHaveLength(1);
  });
});

describe('Tool calls in the details layout', () => {
  it('keep their own section, counting only the calls the chat draws', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <SpanDetailsView traceId={TOOL_CALLS_TRACE_ID} spanId="generation" span={toolCallsGenerationSpan} />
      </TestLinkProvider>,
    );
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(within(toolCallsSection()).getByText('Tool calls (3)')).toBeTruthy();
  });
});

describe.each(LAYOUTS)('Tool calls section (%s)', (_layout, renderSpan) => {
  const render = (span: SpanRecord) => renderWithProviders(<TestLinkProvider>{renderSpan(span)}</TestLinkProvider>);

  describe('when the model called tools', () => {
    it('lists every call the chat would show, in order, and still the tools it was offered', async () => {
      const { queryClient } = render(toolCallsGenerationSpan);
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      // task_write is a task tool the chat never draws, so it is not listed.
      expect(within(toolCallsSection()).getAllByTestId('tool-badge')).toHaveLength(3);
      expect(screen.getByText('Available tools (2)')).toBeTruthy();
    });

    it('opens a call on its input and the result its tool span recorded', async () => {
      const { queryClient } = render(toolCallsGenerationSpan);
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      const [paris] = within(toolCallsSection()).getAllByTestId('tool-badge');
      fireEvent.click(within(paris).getAllByRole('button')[0]);

      expect(await within(paris).findByText(/"paris"/)).toBeTruthy();
      expect(within(paris).getByText(/"Overcast"/)).toBeTruthy();
    });

    it('never clips the list, since each call folds on its own', async () => {
      const { queryClient } = render(toolCallsGenerationSpan);
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      expect(toolCallsSection().querySelector('[data-slot="collapsible-box"]')).toBeNull();
    });

    it('shows the error of a call whose tool failed', async () => {
      const { queryClient } = render(toolCallsGenerationSpan);
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      const [, , read] = within(toolCallsSection()).getAllByTestId('tool-badge');
      fireEvent.click(within(read).getAllByRole('button')[0]);

      expect(await within(read).findByText(/File not found: hello\.md/)).toBeTruthy();
    });
  });

  describe('when the model called no tools', () => {
    it('lists the tools it was offered instead', () => {
      render(noToolCallsGenerationSpan);

      expect(screen.queryByText(/^Tool calls/)).toBeNull();
      expect(screen.getByText('Available tools (1)')).toBeTruthy();
    });
  });
});

describe.each(LAYOUTS)('Output of a step that only called tools (%s)', (_layout, renderSpan) => {
  const outputSection = () => {
    const found = [...document.querySelectorAll('[data-slot="span-payload-section"]')].find(section =>
      section.textContent?.startsWith('Output'),
    );
    if (!(found instanceof HTMLElement)) throw new Error('Missing Output section');
    return found;
  };

  it('reads as JSON, unclipped, with its top-level values folded', async () => {
    const { queryClient } = renderWithProviders(<TestLinkProvider>{renderSpan(toolCallsStepSpan)}</TestLinkProvider>);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    const output = outputSection();
    // Its calls are listed under Tool calls, so there is nothing to preview.
    expect(output.dataset.view).toBe('raw');
    expect(output.querySelector('[data-slot="span-payload-view-toggle"]')).toBeNull();
    expect(output.querySelector('[data-slot="collapsible-box"]')).toBeNull();

    await waitFor(() => expect(output.querySelectorAll('.cm-foldPlaceholder')).toHaveLength(1));
    expect(output.textContent).toContain('"toolCalls"');
    expect(output.textContent).toContain('"finishReason"');
    expect(output.textContent).not.toContain('"paris"');
  });
});
