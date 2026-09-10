import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MessageText } from '../message-text';

const text = '| Status |\n| --- |\n| Pending |';

afterEach(cleanup);

describe('MessageText', () => {
  describe('when text is a warning', () => {
    it('keeps the warning as a notice rather than adding table exports', () => {
      render(<MessageText text={text} metadata={{ status: 'warning' }} tableActions />);
      expect(screen.getByText('Warning')).not.toBeNull();
      expect(screen.getByText(text, { normalizer: value => value })).not.toBeNull();
      expect(screen.queryByRole('table')).toBeNull();
    });
  });

  describe('when text is blocked by a tripwire', () => {
    it('preserves the blocked-content notice and its details', () => {
      render(
        <MessageText
          text={text}
          metadata={{ status: 'tripwire', tripwire: { processorId: 'guardrail', retry: false } }}
          tableActions
        />,
      );
      expect(screen.getByText('Content Blocked')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Details' }));
      expect(screen.getByText('guardrail')).not.toBeNull();
      expect(screen.getByText('Not allowed')).not.toBeNull();
      expect(screen.queryByRole('table')).toBeNull();
    });
  });

  describe('when text is a completion check', () => {
    it.each([true, false])('keeps the completion details collapsible without table exports (passed: %s)', passed => {
      render(<MessageText text={text} metadata={{ completionResult: { passed } }} tableActions />);
      expect(screen.getByText(passed ? 'Complete' : 'Not Complete')).not.toBeNull();
      expect(screen.getByRole('table')).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Copy table as markdown' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Hide completion check' }));
      expect(screen.queryByRole('table')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Show completion check' }));
      expect(screen.getByRole('table')).not.toBeNull();
    });
  });
});
