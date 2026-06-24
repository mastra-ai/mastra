// @vitest-environment jsdom
import type { ToolMockReport } from '@mastra/client-js';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToolMockReportSection } from '../tool-mock-report-section';

const baseReport: ToolMockReport = {
  served: [{ mockIndex: 0, toolName: 'getWeather', args: { city: 'Seattle' } }],
  unconsumed: [{ mockIndex: 1, toolName: 'getWeather', args: { city: 'Paris' } }],
  liveCalls: [{ toolName: 'searchDocs', args: { q: 'mastra' } }],
};

describe('ToolMockReportSection', () => {
  afterEach(cleanup);

  it('renders served, live, and unconsumed rows', () => {
    render(<ToolMockReportSection report={baseReport} />);

    expect(screen.getByTestId('tool-mock-report')).toBeDefined();
    expect(screen.getByText('served')).toBeDefined();
    expect(screen.getByText('live')).toBeDefined();
    expect(screen.getByText('unconsumed')).toBeDefined();
    // tool names appear (getWeather appears twice: served + unconsumed)
    expect(screen.getAllByText('getWeather').length).toBe(2);
    expect(screen.getByText('searchDocs')).toBeDefined();
  });

  it('renders a failure notice when a mock mis-call failed the item', () => {
    const report: ToolMockReport = {
      ...baseReport,
      served: [],
      unconsumed: [{ mockIndex: 0, toolName: 'getWeather', args: { city: 'Seattle' } }],
      liveCalls: [],
      failure: { code: 'TOOL_MOCK_MISMATCH', toolName: 'getWeather', args: { city: 'Paris' } },
    };

    render(<ToolMockReportSection report={report} />);

    expect(screen.getByText(/did not match an available mock/)).toBeDefined();
    expect(screen.getByText(/TOOL_MOCK_MISMATCH/)).toBeDefined();
    // The called args and the unconsumed mock args are surfaced so the mismatch is legible.
    expect(screen.getByText(/Called with: {"city":"Paris"}/)).toBeDefined();
    expect(screen.getByText(/Unconsumed mocks: {"city":"Seattle"}/)).toBeDefined();
  });

  it('renders cleanly when all lists are empty', () => {
    const report: ToolMockReport = { served: [], unconsumed: [], liveCalls: [] };
    render(<ToolMockReportSection report={report} />);
    expect(screen.getByTestId('tool-mock-report')).toBeDefined();
  });
});
