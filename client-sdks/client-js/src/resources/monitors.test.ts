import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';
import type { CreateMonitorParams } from '../types';

// Mock fetch globally
global.fetch = vi.fn();

describe('Monitors Methods', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  const mockSuccessfulResponse = (body: unknown = {}) => {
    const response = new Response(undefined, {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });
    response.json = () => Promise.resolve(body);
    (global.fetch as any).mockResolvedValueOnce(response);
  };

  const monitorParams: CreateMonitorParams = {
    name: 'Relevancy floor',
    filter: { scorerIds: ['relevancy'], metadata: { cohort: 'oncology' } },
    windowMinutes: 60,
    aggregation: 'avg',
    threshold: { op: 'lt', value: 0.7 },
    cooldownMinutes: 30,
    channels: [{ type: 'webhook', url: 'https://hooks.example.com/alerts' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  it('listMonitors() fetches all monitors', async () => {
    mockSuccessfulResponse({ monitors: [] });
    await client.listMonitors();
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/monitors`,
      expect.objectContaining({ headers: expect.objectContaining(clientOptions.headers) }),
    );
  });

  it('getMonitor() fetches a monitor by id', async () => {
    mockSuccessfulResponse();
    await client.getMonitor('mon-1');
    expect(global.fetch).toHaveBeenCalledWith(`${clientOptions.baseUrl}/api/monitors/mon-1`, expect.any(Object));
  });

  it('createMonitor() posts the monitor definition', async () => {
    mockSuccessfulResponse();
    await client.createMonitor(monitorParams);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/monitors`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(monitorParams),
      }),
    );
  });

  it('updateMonitor() patches the monitor', async () => {
    mockSuccessfulResponse();
    await client.updateMonitor('mon-1', { status: 'paused' });
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/monitors/mon-1`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'paused' }),
      }),
    );
  });

  it('deleteMonitor() deletes the monitor', async () => {
    mockSuccessfulResponse();
    await client.deleteMonitor('mon-1');
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/monitors/mon-1`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('listMonitorEvents() fetches event history with filters', async () => {
    mockSuccessfulResponse({ events: [] });
    await client.listMonitorEvents('mon-1', { limit: 10, type: 'breach' });
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/monitors/mon-1/events?limit=10&type=breach`,
      expect.any(Object),
    );
  });

  it('evaluateMonitors() triggers evaluation', async () => {
    mockSuccessfulResponse({ results: [] });
    await client.evaluateMonitors();
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/monitors/evaluate`,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
