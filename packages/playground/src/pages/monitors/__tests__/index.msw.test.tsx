import type { CreateMonitorParams, UpdateMonitorParams } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Monitors from '..';
import { emptyScorers, monitorEvents, noMonitors, oneMonitor, relevancyMonitor } from './fixtures/monitors';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const setBaseHandlers = (monitors = oneMonitor) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/monitors`, () => HttpResponse.json(monitors)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(emptyScorers)),
  );
};

const renderPage = () => renderWithProviders(<Monitors />, { router: true });

describe('Monitors page', () => {
  beforeEach(() => setBaseHandlers());

  it('renders monitors with condition, state and breach badge', async () => {
    renderPage();

    expect(await screen.findByText('Relevancy floor — oncology')).not.toBeNull();
    expect(screen.getByText('avg < 0.7 · relevancy-scorer')).not.toBeNull();
    expect(screen.getByText('active')).not.toBeNull();
    expect(screen.getByText('breached')).not.toBeNull();
  });

  it('shows the empty state when there are no monitors', async () => {
    setBaseHandlers(noMonitors);
    renderPage();

    expect(await screen.findByText('No monitors yet')).not.toBeNull();
    expect(screen.getByText('Create your first monitor')).not.toBeNull();
  });

  it('creates a monitor through the dialog', async () => {
    let createdBody: CreateMonitorParams | undefined;
    server.use(
      http.post(`${TEST_BASE_URL}/api/monitors`, async ({ request }) => {
        createdBody = (await request.json()) as CreateMonitorParams;
        return HttpResponse.json({ ...relevancyMonitor, id: 'monitor-2', name: createdBody.name });
      }),
    );

    const { queryClient } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create Monitor' }));

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Pass-rate watch' } });
    fireEvent.change(screen.getByLabelText('Metadata filter (JSON)'), {
      target: { value: '{"deployment": "v42"}' },
    });
    fireEvent.change(screen.getByLabelText('Webhook URL'), {
      target: { value: 'https://hooks.example.com/x' },
    });

    // Two "Create Monitor" buttons exist now (page toolbar + dialog submit); submit is the last.
    const buttons = screen.getAllByRole('button', { name: 'Create Monitor' });
    fireEvent.click(buttons[buttons.length - 1]!);

    await waitForMutationsIdle(queryClient);
    expect(createdBody?.name).toBe('Pass-rate watch');
    expect(createdBody?.filter?.metadata).toEqual({ deployment: 'v42' });
    expect(createdBody?.threshold).toEqual({ op: 'lt', value: 0.7 });
    expect(createdBody?.channels).toEqual([{ type: 'webhook', url: 'https://hooks.example.com/x', format: 'json' }]);
  });

  it('rejects invalid metadata JSON without posting', async () => {
    const onCreate = vi.fn<() => void>();
    server.use(
      http.post(`${TEST_BASE_URL}/api/monitors`, () => {
        onCreate();
        return HttpResponse.json(relevancyMonitor);
      }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create Monitor' }));
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Bad filter' } });
    fireEvent.change(screen.getByLabelText('Metadata filter (JSON)'), { target: { value: 'not-json' } });

    const buttons = screen.getAllByRole('button', { name: 'Create Monitor' });
    fireEvent.click(buttons[buttons.length - 1]!);

    await act(() => new Promise(resolve => setTimeout(resolve, 50)));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('pauses an active monitor via PATCH', async () => {
    let patchBody: UpdateMonitorParams | undefined;
    server.use(
      http.patch(`${TEST_BASE_URL}/api/monitors/${relevancyMonitor.id}`, async ({ request }) => {
        patchBody = (await request.json()) as UpdateMonitorParams;
        return HttpResponse.json({ ...relevancyMonitor, status: 'paused' });
      }),
    );

    const { queryClient } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Pause' }));

    await waitForMutationsIdle(queryClient);
    expect(patchBody).toEqual({ status: 'paused' });
  });

  it('deletes a monitor', async () => {
    const onDelete = vi.fn<() => void>();
    server.use(
      http.delete(`${TEST_BASE_URL}/api/monitors/${relevancyMonitor.id}`, () => {
        onDelete();
        return HttpResponse.json({ success: true });
      }),
    );

    const { queryClient } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitForMutationsIdle(queryClient);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('shows monitor events with drill-down link to matching scores', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/monitors/${relevancyMonitor.id}/events`, () => HttpResponse.json(monitorEvents)),
    );

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Events' }));

    expect(await screen.findByText('Breach')).not.toBeNull();
    expect(screen.getByText('0.5200')).not.toBeNull();
    expect(screen.getByText('threshold lt 0.7')).not.toBeNull();

    const link = screen.getByRole('link', { name: 'View matching scores' });
    expect(link.getAttribute('href')).toBe('/scorers/relevancy-scorer');
  });

  it('renders the events empty state when a monitor has no history', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/monitors/${relevancyMonitor.id}/events`, () => HttpResponse.json({ events: [] })),
    );

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Events' }));

    expect(await screen.findByText('No events yet')).not.toBeNull();
  });

  it('waits for pending state before rendering the list', async () => {
    let resolveMonitors: () => void = () => {};
    const gate = new Promise<void>(resolve => {
      resolveMonitors = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/api/monitors`, async () => {
        await gate;
        return HttpResponse.json(oneMonitor);
      }),
    );

    renderPage();
    expect(screen.queryByText('Relevancy floor — oncology')).toBeNull();

    resolveMonitors();
    await waitFor(() => expect(screen.queryByText('Relevancy floor — oncology')).not.toBeNull());
  });
});
