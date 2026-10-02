import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { StudioApp } from './app';
import type { StudioConfiguration } from './app';
import { server } from './test/server';
import { traceQueryCapabilities, traceQueryPage } from './test/fixtures';

const origin = 'https://mastra.example.com';
const requests: Request[] = [];
const bodies: unknown[] = [];
function renderApp(configuration: StudioConfiguration = { baseUrl: origin, apiPrefix: '/api' }) {
  return render(<StudioApp configuration={configuration} />);
}
async function connect() {
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
}
beforeEach(() => {
  requests.length = 0;
  bodies.length = 0;
  serveTraces(origin);
});
function serveTraces(baseUrl: string) {
  server.use(
    http.get(`${baseUrl}/api/observability/capabilities`, () => HttpResponse.json(traceQueryCapabilities)),
    http.get(`${baseUrl}/api/observability/discovery/entity-names`, () => HttpResponse.json({ names: [] })),
    http.get(`${baseUrl}/api/observability/discovery/environments`, () => HttpResponse.json({ environments: [] })),
    http.post(`${baseUrl}/api/observability/traces/query/fields`, () =>
      HttpResponse.json({ canonicalFields: [], observedFields: [], observedFieldsTruncated: false }),
    ),
    http.post(`${baseUrl}/api/observability/traces/query`, async ({ request }) => {
      requests.push(request);
      bodies.push(await request.json());
      return HttpResponse.json(traceQueryPage);
    }),
  );
}

describe('Studio MCP App', () => {
  describe('when the app opens', () => {
    it('asks for the public URL before fetching traces', () => {
      renderApp();
      expect(screen.getByRole('textbox', { name: /Mastra instance URL/ }).getAttribute('value')).toBe(origin);
      expect(requests).toHaveLength(0);
      expect(screen.queryByText('Headers')).toBeNull();
    });
  });
  describe('when connected to the public server', () => {
    it('renders the real Studio trace list without sending credentials', async () => {
      renderApp();
      await connect();
      expect(await screen.findByText('Studio preview agent')).toBeDefined();
      expect(requests[0]?.credentials).toBe('omit');
      expect(requests[0]?.headers.has('authorization')).toBe(false);
      expect(requests[0]?.headers.has('ngrok-skip-browser-warning')).toBe(false);
    });
    it('loads traces through an ngrok development tunnel without its browser interstitial', async () => {
      const tunnelUrl = 'https://studio-preview.ngrok-free.app';
      serveTraces(tunnelUrl);
      server.use(
        http.get(`${tunnelUrl}/api/observability/capabilities`, ({ request }) =>
          request.headers.has('ngrok-skip-browser-warning')
            ? HttpResponse.json(traceQueryCapabilities)
            : HttpResponse.text('ERR_NGROK_6024'),
        ),
      );
      renderApp({ baseUrl: tunnelUrl, apiPrefix: '/api' });
      await connect();
      expect(await screen.findByText('Studio preview agent')).toBeDefined();
      expect(requests[0]?.credentials).toBe('omit');
      expect(requests[0]?.headers.has('authorization')).toBe(false);
    });
    it('changes the query when a status filter is selected', async () => {
      renderApp();
      await connect();
      const input = await screen.findByRole('combobox', { name: 'Add filter' });
      act(() => input.focus());
      fireEvent.change(input, { target: { value: 'Status' } });
      await screen.findByRole('option', { name: 'Status' });
      fireEvent.keyDown(input, { key: 'Enter' });
      await screen.findByRole('option', { name: 'is' });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.change(input, { target: { value: 'Error' } });
      await screen.findByRole('option', { name: 'Error' });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() =>
        expect(bodies.at(-1)).toMatchObject({
          where: {
            op: 'and',
            args: expect.arrayContaining([{ op: 'eq', left: { path: 'status' }, right: { literal: 'error' } }]),
          },
        }),
      );
    });
    it('clears the connection when the user changes servers', async () => {
      renderApp();
      await connect();
      await screen.findByText('Studio preview agent');
      fireEvent.click(screen.getByRole('button', { name: 'Change server' }));
      expect(screen.getByRole('button', { name: 'Connect' })).toBeDefined();
    });
  });
  describe('when another origin is entered', () => {
    it('explains how to connect that server without making a request', async () => {
      renderApp();
      fireEvent.change(screen.getByRole('textbox', { name: /Mastra instance URL/ }), {
        target: { value: 'https://another.example.com' },
      });
      await connect();
      expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('MCP endpoint'));
      expect(requests).toHaveLength(0);
    });
  });
  describe('when testing a different localhost server', () => {
    const previewUrl = 'http://127.0.0.1:4117';
    const targetUrl = 'http://localhost:4112';

    it('loads traces from the selected local server in a local preview', async () => {
      serveTraces(targetUrl);
      renderApp({ baseUrl: previewUrl, apiPrefix: '/api', localPreview: true });
      fireEvent.change(screen.getByRole('textbox', { name: /Mastra instance URL/ }), {
        target: { value: `${targetUrl}/` },
      });
      await connect();
      expect(await screen.findByText('Studio preview agent')).toBeDefined();
      expect(requests[0]?.url).toBe(`${targetUrl}/api/observability/traces/query`);
      expect(requests[0]?.credentials).toBe('omit');
    });

    it('keeps the same-origin restriction for an MCP resource without preview mode', async () => {
      renderApp({ baseUrl: previewUrl, apiPrefix: '/api' });
      fireEvent.change(screen.getByRole('textbox', { name: /Mastra instance URL/ }), {
        target: { value: targetUrl },
      });
      await connect();
      expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('MCP endpoint'));
      expect(requests).toHaveLength(0);
    });

    it('does not extend preview access to non-loopback servers', async () => {
      renderApp({ baseUrl: previewUrl, apiPrefix: '/api', localPreview: true });
      fireEvent.change(screen.getByRole('textbox', { name: /Mastra instance URL/ }), {
        target: { value: 'https://another.example.com' },
      });
      await connect();
      expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('MCP endpoint'));
      expect(requests).toHaveLength(0);
    });
  });
  describe('when traces cannot be loaded', () => {
    it('shows a recoverable connection error', async () => {
      server.use(
        http.post(`${origin}/api/observability/traces/query`, () =>
          HttpResponse.json({ error: 'Unavailable' }, { status: 503 }),
        ),
      );
      renderApp();
      await connect();
      expect(await screen.findByText('Failed to load traces')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    });
  });
});
