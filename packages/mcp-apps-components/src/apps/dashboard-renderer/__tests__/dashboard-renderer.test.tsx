// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { MASTRA_API_TOOL } from '../../../mastra-api';
import { MASTRA_SERVER, renderWithHost } from '../../../test/host';
import { server } from '../../../test/msw-server';
import { app } from '../app';
import { agentRunsAggregate, agentRunsDashboard, emptyTimeSeries, supportRunsChart } from './fixtures/dashboard';

const AGGREGATE_API = `${MASTRA_SERVER}/observability/metrics/aggregate`;
const TIME_SERIES_API = `${MASTRA_SERVER}/observability/metrics/timeseries`;

type AggregateBody = { filters: { timestamp: { start: string; end: string } } };

describe('dashboard renderer app', () => {
  describe('when the host has not sent the tool result yet', () => {
    it('shows that the dashboard is loading', async () => {
      await renderWithHost(app);

      expect(await screen.findByText('Loading dashboard')).toBeTruthy();
    });
  });

  describe('when the tool result carries a dashboard', () => {
    it('renders the widgets with metrics read through the host', async () => {
      server.use(http.post(AGGREGATE_API, () => HttpResponse.json(agentRunsAggregate)));
      const host = await renderWithHost(app);

      await host.sendToolResult({ content: [], structuredContent: { definition: agentRunsDashboard } });

      expect(await screen.findByText('Agent runs')).toBeTruthy();
      expect(await screen.findByText('693')).toBeTruthy();
      // The iframe never reaches the network itself: MSW fails any request it didn't expect,
      // and every read went through the server's tool.
      expect(host.toolCalls.length).toBeGreaterThan(0);
      expect(host.toolCalls.every(name => name === MASTRA_API_TOOL)).toBe(true);
    });
  });

  describe("when the server's route fails", () => {
    it('shows the error in the widget instead of the value', async () => {
      server.use(http.post(AGGREGATE_API, () => HttpResponse.json({ error: 'Forbidden' }, { status: 403 })));
      const host = await renderWithHost(app);

      await host.sendToolResult({ content: [], structuredContent: { definition: agentRunsDashboard } });

      expect(await screen.findByText('Agent runs')).toBeTruthy();
      await expect.poll(() => host.toolCalls.length).toBeGreaterThan(0);
      expect(screen.queryByText('693')).toBeNull();
    });
  });

  describe('when the definition sets a default time range', () => {
    it('fetches metrics over that range', async () => {
      const windowsInHours: number[] = [];
      server.use(
        http.post<never, AggregateBody>(AGGREGATE_API, async ({ request }) => {
          const body = await request.json();
          const { start, end } = body.filters.timestamp;
          windowsInHours.push(Math.round((new Date(end).getTime() - new Date(start).getTime()) / 3_600_000));
          return HttpResponse.json(agentRunsAggregate);
        }),
      );
      const host = await renderWithHost(app);

      await host.sendToolResult({
        content: [],
        structuredContent: { definition: { ...agentRunsDashboard, defaults: { datePreset: '7d' } } },
      });

      expect(await screen.findByText('693')).toBeTruthy();
      expect(windowsInHours).toContain(7 * 24);
      expect(windowsInHours).not.toContain(24);
    });
  });

  describe('when the host forwards the tool output only as JSON text', () => {
    it('renders the dashboard from the text content', async () => {
      server.use(http.post(AGGREGATE_API, () => HttpResponse.json(agentRunsAggregate)));
      const host = await renderWithHost(app);

      await host.sendToolResult({
        content: [{ type: 'text', text: JSON.stringify({ definition: agentRunsDashboard }) }],
      });

      expect(await screen.findByText('693')).toBeTruthy();
    });
  });

  describe('when the tool result has no dashboard', () => {
    it('explains which field is wrong instead of rendering', async () => {
      const host = await renderWithHost(app);

      await host.sendToolResult({ content: [], structuredContent: { scope: 'project' } });

      expect(await screen.findByText("Couldn't show this dashboard")).toBeTruthy();
      expect(screen.getByText(/`definition`/)).toBeTruthy();
    });
  });

  describe('when the user drills into a chart', () => {
    it('asks for that data in the chat', async () => {
      server.use(http.post(TIME_SERIES_API, () => HttpResponse.json(emptyTimeSeries)));
      const host = await renderWithHost(app);
      await host.sendToolResult({ content: [], structuredContent: { definition: supportRunsChart } });

      fireEvent.click(await screen.findByRole('button', { name: 'View in traces' }));

      await expect
        .poll(() => host.messages)
        .toEqual(['Show me the traces for entityName "support", over the last 24h.']);
    });

    it('offers no drilldown on hosts without a chat to continue', async () => {
      server.use(http.post(TIME_SERIES_API, () => HttpResponse.json(emptyTimeSeries)));
      const host = await renderWithHost(app, { capabilities: { serverTools: {} } });
      await host.sendToolResult({ content: [], structuredContent: { definition: supportRunsChart } });

      expect(await screen.findByText('Support runs')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'View in traces' })).toBeNull();
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
      await renderWithHost(app, { hostContext: { theme: 'light' } });

      expect(document.documentElement.classList.contains('light')).toBe(true);
    });

    it('follows the host back to dark', async () => {
      const host = await renderWithHost(app, { hostContext: { theme: 'light' } });

      await host.setHostContext({ theme: 'dark' });

      await expect.poll(() => document.documentElement.classList.contains('light')).toBe(false);
    });
  });
});
