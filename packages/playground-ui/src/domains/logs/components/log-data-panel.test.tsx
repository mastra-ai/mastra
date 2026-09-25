// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LogRecord } from '../types';
import { LogDataPanel } from './log-data-panel';

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
    it('shows the full timestamp at heading size, not as caption', () => {
      render(<LogDataPanel log={log} onClose={vi.fn()} />);

      const heading = screen.getByRole('heading', { name: /Sep 24, 2026, 9:40:48\.289 AM/ });
      expect(heading.querySelector('b')).toBeNull();
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
