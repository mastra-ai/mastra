// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { TraceSpanPanel } from '../trace-span-panel';
import { ORIGIN_TRACE_ID, originSpanDetailById, originTraceSpans } from './fixtures/system-message-origin';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const originalOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight',
) as PropertyDescriptor;
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth') as PropertyDescriptor;
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
});
afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
});

const onSpanDetailRequest = vi.fn<(spanId: string) => void>();

const installHandlers = () => {
  onSpanDetailRequest.mockClear();
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, ({ params }) => {
      const spanId = String(params.spanId);
      onSpanDetailRequest(spanId);
      const detail = originSpanDetailById[spanId];
      return detail ? HttpResponse.json(detail) : HttpResponse.json({ error: 'not found' }, { status: 404 });
    }),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(originTraceSpans)),
    http.get(`${TEST_BASE_URL}/api/observability/feedback`, () =>
      HttpResponse.json({ feedback: [], pagination: { page: 0, perPage: 10, total: 0, hasMore: false } }),
    ),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json({})),
  );
};

function Harness({ onSpanSelect }: { onSpanSelect: (spanId: string | undefined) => void }) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>('infer1');
  return (
    <TraceSpanPanel
      traceId={ORIGIN_TRACE_ID}
      spans={originTraceSpans.spans}
      isLoadingSpans={false}
      selectedSpanId={selectedSpanId}
      onSpanSelect={spanId => {
        setSelectedSpanId(spanId ?? null);
        onSpanSelect(spanId);
      }}
      onClose={() => {}}
    />
  );
}

const renderInferenceSpan = () => {
  const onSpanSelect = vi.fn<(spanId: string | undefined) => void>();
  const utils = renderWithProviders(
    <TestLinkProvider>
      <Harness onSpanSelect={onSpanSelect} />
    </TestLinkProvider>,
  );
  return { ...utils, onSpanSelect };
};

const systemMessage = async (content: string) => {
  const text = await screen.findByText(content);
  const message = text.closest<HTMLElement>('[data-role="system"]');
  if (!message) throw new Error(`"${content}" is not rendered as a system message`);
  return message;
};

describe('System message origin in the inference span input', () => {
  it('links a system message to the span that added it, and selects that span on click', async () => {
    installHandlers();
    const { onSpanSelect, queryClient } = renderInferenceSpan();

    const injected = await systemMessage('Injected by processor');
    const link = within(injected).getByRole('button', { name: /input processor: injector/ });
    expect(within(await systemMessage('Base instructions')).getByRole('button', { name: /agent run/ })).not.toBeNull();

    fireEvent.click(link);

    expect(onSpanSelect).toHaveBeenCalledWith('proc01');
    await waitFor(() => expect(onSpanDetailRequest).toHaveBeenCalledWith('proc01'));
    await waitFor(() => expect(screen.queryByText('Injected by processor')).toBeNull());
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('shows no link when the origin span is not in the trace or the message has no origin', async () => {
    installHandlers();
    const { queryClient } = renderInferenceSpan();

    const unexported = await systemMessage('Added by an unexported span');
    const rewritten = await systemMessage('Rewritten at request time');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(within(unexported).queryByRole('button')).toBeNull();
    expect(within(rewritten).queryByRole('button')).toBeNull();
  });
});
