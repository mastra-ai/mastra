// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderWithHost } from '../../../test/host';
import { server } from '../../../test/msw-server';
import { app } from '../app';
import { agentRunsAggregate, agentRunsDashboard } from './fixtures/dashboard';

const BASE_URL = 'http://mastra.test';
const AGGREGATE_API = `${BASE_URL}/api/observability/metrics/aggregate`;

describe('dashboard renderer app', () => {
  describe('when the host has not sent the tool result yet', () => {
    it('shows that the dashboard is loading', async () => {
      await renderWithHost(app);

      expect(await screen.findByText('Loading dashboard')).toBeTruthy();
    });
  });

  describe('when the tool result carries a dashboard and server credentials', () => {
    it('renders the widgets with metrics fetched from that server using those headers', async () => {
      const authHeaders: (string | null)[] = [];
      server.use(
        http.post(AGGREGATE_API, ({ request }) => {
          authHeaders.push(request.headers.get('authorization'));
          return HttpResponse.json(agentRunsAggregate);
        }),
      );
      const host = await renderWithHost(app);

      await host.sendToolResult({
        content: [],
        structuredContent: {
          definition: agentRunsDashboard,
          baseUrl: BASE_URL,
          headers: { Authorization: 'Bearer secret' },
        },
      });

      expect(await screen.findByText('Agent runs')).toBeTruthy();
      expect(await screen.findByText('693')).toBeTruthy();
      expect(authHeaders.length).toBeGreaterThan(0);
      expect(authHeaders.every(header => header === 'Bearer secret')).toBe(true);
    });
  });

  describe('when the tool result has no server to fetch from', () => {
    it('explains which field is wrong instead of rendering', async () => {
      const host = await renderWithHost(app);

      await host.sendToolResult({ content: [], structuredContent: { definition: agentRunsDashboard } });

      expect(await screen.findByText("Couldn't show this dashboard")).toBeTruthy();
      expect(screen.getByText(/`baseUrl`/)).toBeTruthy();
    });
  });

  describe('when the tool call failed', () => {
    it('shows the error the tool reported', async () => {
      const host = await renderWithHost(app);

      await host.sendToolResult({ isError: true, content: [{ type: 'text', text: 'Dashboard not found' }] });

      expect(await screen.findByText('Dashboard not found')).toBeTruthy();
    });
  });

  describe('when the tool call is cancelled', () => {
    it('stops loading and says so', async () => {
      const host = await renderWithHost(app);

      await host.sendToolCancelled();

      expect(await screen.findByText('The tool call was cancelled.')).toBeTruthy();
    });
  });

  describe('when the host uses a light theme', () => {
    it('switches the design system to its light theme', async () => {
      await renderWithHost(app, { theme: 'light' });

      expect(document.documentElement.classList.contains('light')).toBe(true);
    });

    it('follows the host back to dark', async () => {
      const host = await renderWithHost(app, { theme: 'light' });

      await host.setHostContext({ theme: 'dark' });

      await expect.poll(() => document.documentElement.classList.contains('light')).toBe(false);
    });
  });
});
