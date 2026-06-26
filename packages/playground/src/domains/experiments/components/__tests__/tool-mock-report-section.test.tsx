// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToolMockReportSection } from '../tool-mock-report-section';
import { baseReport, emptyReport, failureReport } from './fixtures/tool-mock-report';

describe('ToolMockReportSection', () => {
  afterEach(cleanup);

  describe('when the report has served, live, and unconsumed mocks', () => {
    it('renders a row for each category', () => {
      render(<ToolMockReportSection report={baseReport} />);

      expect(screen.getByTestId('tool-mock-report')).toBeDefined();
      expect(screen.getByText('served')).toBeDefined();
      expect(screen.getByText('live')).toBeDefined();
      expect(screen.getByText('unconsumed')).toBeDefined();
      // tool names appear (getWeather appears twice: served + unconsumed)
      expect(screen.getAllByText('getWeather').length).toBe(2);
      expect(screen.getByText('searchDocs')).toBeDefined();
    });
  });

  describe('when a mock mis-call failed the item', () => {
    it('renders a failure notice surfacing the called and unconsumed args', () => {
      render(<ToolMockReportSection report={failureReport} />);

      expect(screen.getByText(/did not match an available mock/)).toBeDefined();
      expect(screen.getByText(/TOOL_MOCK_MISMATCH/)).toBeDefined();
      // The called args and the unconsumed mock args are surfaced so the mismatch is legible.
      expect(screen.getByText(/Called with: {"city":"Paris"}/)).toBeDefined();
      expect(screen.getByText(/Unconsumed mocks: {"city":"Seattle"}/)).toBeDefined();
    });
  });

  describe('when every list is empty', () => {
    it('renders cleanly', () => {
      render(<ToolMockReportSection report={emptyReport} />);
      expect(screen.getByTestId('tool-mock-report')).toBeDefined();
    });
  });
});
