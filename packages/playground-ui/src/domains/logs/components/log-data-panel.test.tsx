// @vitest-environment jsdom
import '@/test/english-locale';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LogRecord } from '../types';
import { LogDataPanel } from './log-data-panel';
import { TooltipProvider } from '@/ds/components/Tooltip';

afterEach(cleanup);

const log = {
  logId: 'log-1',
  timestamp: new Date(2026, 8, 24, 9, 40, 48, 289),
  level: 'error',
  message: 'Agent with name agent-playground not found',
  serviceName: 'mastra',
} as LogRecord;

describe('LogDataPanel', () => {
  describe('when a log is open', () => {
    it('shows the Log heading and the precise timestamp as metadata in the same header', () => {
      render(<LogDataPanel log={log} onClose={vi.fn()} />);

      const panel = within(screen.getByRole('dialog', { name: 'Log Sep 24, 2026, 9:40:48.289 AM' }));
      const heading = panel.getByRole('heading', { name: 'Log' });
      const metadata = panel.getByRole('list');
      expect(within(metadata).getByRole('listitem').textContent).toBe('Sep 24, 2026, 9:40:48.289 AM');
      expect(metadata.parentElement).toBe(heading.parentElement);
    });

    it('makes the full timestamp available to keyboard users through a tooltip', async () => {
      render(
        <TooltipProvider delay={0}>
          <LogDataPanel log={log} onClose={vi.fn()} />
        </TooltipProvider>,
      );

      const metadata = within(screen.getByRole('list'));
      const timestamp = metadata.getByLabelText('Sep 24, 2026, 9:40:48.289 AM');
      expect(timestamp.tabIndex).toBe(0);

      fireEvent.focus(timestamp);

      expect((await screen.findByRole('tooltip')).textContent).toBe('Sep 24, 2026, 9:40:48.289 AM');
    });

    it('renders the message in a "Message" code section', () => {
      render(<LogDataPanel log={log} onClose={vi.fn()} />);

      const label = screen.getByText('Message');
      const message = screen.getByText(log.message);
      expect(label.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(message.closest('p')).toBeNull();
    });

    it('lists the key/values above the message', () => {
      render(<LogDataPanel log={log} onClose={vi.fn()} />);

      const serviceKey = screen.getByText('Service');
      const messageLabel = screen.getByText('Message');
      expect(serviceKey.compareDocumentPosition(messageLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
