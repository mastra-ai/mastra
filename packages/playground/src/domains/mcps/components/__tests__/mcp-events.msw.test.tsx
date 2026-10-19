import type { McpServerEventPollResponse, McpServerEventStreamFrame } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { McpEventDrawer } from '../mcp-event-drawer/mcp-event-drawer';
import { MCPDetail } from '../MCPDetail';
import {
  activeFrame,
  buildFinished,
  eventFrame,
  eventList,
  eventsServer,
  occurrence,
  sseChunk,
} from './fixtures/mcp-events';
import { authDisabled, emptyToolList, v2Server } from './fixtures/mcp-servers';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const EVENTS_URL = `${TEST_BASE_URL}/api/mcp/tickets/events`;
const GAP = 'Gap: events may have been skipped';

/** An SSE body the test writes frames into; `cancelled` fires when the client aborts the request. */
function sseStream() {
  const encoder = new TextEncoder();
  const cancelled = vi.fn<() => void>();
  let sink: ReadableStreamDefaultController<Uint8Array> | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      sink = controller;
    },
  });
  const push = (frame: McpServerEventStreamFrame) => sink?.enqueue(encoder.encode(sseChunk(frame)));
  return { body, push, cancelled };
}

const useEventHandlers = ({ testEmit = false } = {}) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabled)),
    http.get(EVENTS_URL, () => HttpResponse.json(eventList(testEmit))),
  );
};

const useStream = (stream: ReturnType<typeof sseStream>, onBody?: (body: unknown) => void) => {
  server.use(
    http.post(`${EVENTS_URL}/ticket.created/stream`, async ({ request }) => {
      request.signal.addEventListener('abort', () => stream.cancelled());
      onBody?.(await request.json());
      return new HttpResponse(stream.body, { headers: { 'content-type': 'text/event-stream' } });
    }),
  );
};

const renderDrawer = (eventName = 'ticket.created') =>
  renderWithProviders(<McpEventDrawer serverId="tickets" />, {
    router: { initialEntries: [`/mcps/tickets?event=${eventName}`] },
  });

const openPlayground = async () => fireEvent.click(await screen.findByRole('tab', { name: 'Playground' }));

const occurrenceIds = () =>
  within(screen.getByRole('list', { name: 'Occurrences' }))
    .getAllByRole('listitem')
    .map(item => item.textContent ?? '');

describe('MCPDetail events section', () => {
  describe('when the server declares no events', () => {
    it('renders no Events section and never requests events', async () => {
      const onEvents = vi.fn<() => void>();
      server.use(
        http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(emptyToolList)),
        http.get(`${TEST_BASE_URL}/api/mcp/:serverId/events`, () => {
          onEvents();
          return HttpResponse.json(eventList(false));
        }),
      );

      renderWithProviders(
        <TestLinkProvider>
          <MCPDetail isLoading={false} server={v2Server} />
        </TestLinkProvider>,
      );

      expect(await screen.findByRole('heading', { name: 'Available tools' })).not.toBeNull();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(screen.queryByRole('heading', { name: 'Events' })).toBeNull();
      expect(onEvents).not.toHaveBeenCalled();
    });
  });

  describe('when the server declares events', () => {
    it('lists each event with its delivery modes', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(emptyToolList)),
        http.get(EVENTS_URL, () => HttpResponse.json(eventList(false))),
      );

      renderWithProviders(
        <TestLinkProvider>
          <MCPDetail isLoading={false} server={eventsServer} />
        </TestLinkProvider>,
      );

      const row = (await screen.findByText('ticket.created')).closest('a');
      expect(row?.getAttribute('href')).toBe('/mcps/tickets?event=ticket.created');
      expect(row?.textContent).toContain('push');
      expect(row?.textContent).toContain('poll');
      expect(screen.getByText('build.finished').closest('a')?.textContent).not.toContain('push');
    });
  });
});

describe('MCP event drawer', () => {
  describe('when opened on an event', () => {
    it('shows its argument and payload schemas', async () => {
      useEventHandlers();
      renderDrawer();

      expect(await screen.findByText('Arguments')).not.toBeNull();
      expect(screen.getByText('Payload')).not.toBeNull();
      expect(screen.getByText('project')).not.toBeNull();
      expect(screen.getByText('title')).not.toBeNull();
    });
  });

  describe('when the stream opens', () => {
    it('shows it is listening, the cursor, and occurrences newest first', async () => {
      useEventHandlers();
      const stream = sseStream();
      const onBody = vi.fn<(body: unknown) => void>();
      useStream(stream, onBody);
      renderDrawer();
      await openPlayground();

      fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
      stream.push(activeFrame());
      stream.push(eventFrame('evt-1', 'First'));
      stream.push(eventFrame('evt-2', 'Second'));

      expect(await screen.findByText('Listening')).not.toBeNull();
      await waitFor(() => expect(occurrenceIds()).toHaveLength(2));
      expect(occurrenceIds()[0]).toContain('evt-2');
      expect(occurrenceIds()[1]).toContain('evt-1');
      expect(screen.getByText('cursor-evt-2')).not.toBeNull();
      expect(onBody).toHaveBeenCalledWith({ arguments: { project: '' } });
    });
  });

  describe('when the stream reports a gap', () => {
    it('marks where events may have been skipped', async () => {
      useEventHandlers();
      const stream = sseStream();
      useStream(stream);
      renderDrawer();
      await openPlayground();

      fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
      stream.push(activeFrame(true));
      stream.push(eventFrame('evt-3', 'After gap'));

      await waitFor(() => expect(occurrenceIds()).toHaveLength(2));
      expect(occurrenceIds()[0]).toContain('evt-3');
      expect(occurrenceIds()[1]).toBe(GAP);
    });
  });

  describe('when the user stops the stream', () => {
    it('cancels the request and shows it stopped', async () => {
      useEventHandlers();
      const stream = sseStream();
      useStream(stream);
      renderDrawer();
      await openPlayground();

      fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
      stream.push(activeFrame());
      await screen.findByText('Listening');
      fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

      expect(await screen.findByText('Stopped')).not.toBeNull();
      await waitFor(() => expect(stream.cancelled).toHaveBeenCalled());
      expect(screen.getByRole('button', { name: 'Start' })).not.toBeNull();
    });
  });

  describe('when the drawer unmounts with the stream open', () => {
    it('cancels the request', async () => {
      useEventHandlers();
      const stream = sseStream();
      useStream(stream);
      const { unmount } = renderDrawer();
      await openPlayground();

      fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
      stream.push(activeFrame());
      await screen.findByText('Listening');
      unmount();

      await waitFor(() => expect(stream.cancelled).toHaveBeenCalled());
    });
  });

  describe('when the server rejects the stream', () => {
    it('shows the server message', async () => {
      useEventHandlers();
      server.use(
        http.post(`${EVENTS_URL}/ticket.created/stream`, () =>
          HttpResponse.json({ error: 'Invalid event arguments' }, { status: 400 }),
        ),
      );
      renderDrawer();
      await openPlayground();

      fireEvent.click(await screen.findByRole('button', { name: 'Start' }));

      expect(await screen.findByText('Invalid event arguments')).not.toBeNull();
      expect(screen.getByText('Failed')).not.toBeNull();
    });
  });

  describe('when the event is poll-only', () => {
    it('offers Poll once instead of Start, and renders polled occurrences and gaps', async () => {
      useEventHandlers();
      const polled: McpServerEventPollResponse = {
        events: [occurrence('build-1', 'one'), occurrence('build-2', 'two')],
        cursor: 'cursor-build-2',
        truncated: true,
      };
      server.use(http.post(`${EVENTS_URL}/${buildFinished.name}/poll`, () => HttpResponse.json(polled)));
      renderDrawer(buildFinished.name);
      await openPlayground();

      const pollButton = await screen.findByRole('button', { name: 'Poll once' });
      expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
      fireEvent.click(pollButton);

      await waitFor(() => expect(occurrenceIds()).toHaveLength(3));
      expect(occurrenceIds()[0]).toContain('build-2');
      expect(occurrenceIds()[1]).toContain('build-1');
      expect(occurrenceIds()[2]).toBe(GAP);
      expect(screen.getByText('cursor-build-2')).not.toBeNull();
    });
  });

  describe('when test emit is not served', () => {
    it('hides Send test event', async () => {
      useEventHandlers({ testEmit: false });
      renderDrawer();
      await openPlayground();

      await screen.findByRole('button', { name: 'Start' });
      expect(screen.queryByRole('region', { name: 'Send test event' })).toBeNull();
    });
  });

  describe('when the event is fed by a poll source', () => {
    it('hides Send test event even under mastra dev', async () => {
      useEventHandlers({ testEmit: true });
      renderDrawer(buildFinished.name);
      await openPlayground();

      await screen.findByRole('button', { name: 'Poll once' });
      expect(screen.queryByRole('region', { name: 'Send test event' })).toBeNull();
    });
  });

  describe('when test emit is served for an emit-fed event', () => {
    it('sends the payload and shows the test occurrence from the open stream', async () => {
      useEventHandlers({ testEmit: true });
      const stream = sseStream();
      useStream(stream);
      const onEmit = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(`${EVENTS_URL}/ticket.created/emit`, async ({ request }) => {
          onEmit(await request.json());
          stream.push(eventFrame('mastra-test-1', 'From Studio'));
          return HttpResponse.json({ occurrence: occurrence('mastra-test-1', 'From Studio') });
        }),
      );
      renderDrawer();
      await openPlayground();
      fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
      stream.push(activeFrame());
      await screen.findByText('Listening');

      const emitForm = screen.getByRole('region', { name: 'Send test event' });
      fireEvent.change(within(emitForm).getByRole('textbox'), { target: { value: 'From Studio' } });
      fireEvent.click(within(emitForm).getByRole('button', { name: 'Send test event' }));

      await waitFor(() => expect(onEmit).toHaveBeenCalledWith({ data: { title: 'From Studio' } }));
      await waitFor(() => expect(occurrenceIds()).toHaveLength(1));
      expect(occurrenceIds()[0]).toContain('mastra-test-1');
      expect(occurrenceIds()[0]).toContain('test');
    });
  });
});
