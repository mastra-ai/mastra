// @vitest-environment jsdom
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

  describe('when the metadata status is tripwire', () => {
    it('renders the tripwire notice with the text as reason', () => {
      render(<MessageText text="blocked for safety" metadata={{ status: 'tripwire' }} />);

      expect(screen.getByText('Content Blocked')).not.toBeNull();
      expect(screen.getByText('blocked for safety')).not.toBeNull();
    });
  });

  describe('when the metadata status is warning', () => {
    it('renders a warning notice with the text', () => {
      const { container } = render(<MessageText text="careful" metadata={{ status: 'warning' }} />);

      expect(screen.getByText('Warning')).not.toBeNull();
      expect(screen.getByText('careful')).not.toBeNull();
      expect(container.querySelector('[class*="notice-warning"]')).not.toBeNull();
    });
  });

  describe('when the text is an error', () => {
    it('renders a destructive notice with the cleaned error message', () => {
      const { container } = render(<MessageText text="__ERROR__: boom" metadata={undefined} />);

      expect(screen.getByText('Error')).not.toBeNull();
      expect(screen.getByText('boom')).not.toBeNull();
      expect(screen.queryByText('__ERROR__: boom')).toBeNull();
      expect(container.querySelector('[class*="notice-destructive"]')).not.toBeNull();
    });
  });

  describe('when the metadata carries a completion result', () => {
    it('shows the completion check expanded with a Complete title when passed', () => {
      render(<MessageText text="Task done" metadata={{ completionResult: { passed: true } }} />);

      expect(screen.getByRole('button', { name: /Hide completion check/ })).not.toBeNull();
      expect(screen.getByText('Complete')).not.toBeNull();
      expect(screen.getByText('Task done')).not.toBeNull();
    });

    it('titles the notice Not Complete when the check failed', () => {
      render(<MessageText text="Missing tests" metadata={{ completionResult: { passed: false } }} />);

      expect(screen.getByText('Not Complete')).not.toBeNull();
    });

    it('collapses and re-expands the notice when the badge is clicked', () => {
      render(<MessageText text="Task done" metadata={{ completionResult: { passed: true } }} />);

      fireEvent.click(screen.getByRole('button', { name: /Hide completion check/ }));
      expect(screen.queryByText('Task done')).toBeNull();
      expect(screen.getByRole('button', { name: /Show completion check/ })).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /Show completion check/ }));
      expect(screen.getByText('Task done')).not.toBeNull();
    });
  });

  describe('when the text is plain prose', () => {
    it('renders markdown', () => {
      render(<MessageText text="**bold** text" metadata={undefined} />);

      expect(screen.getByText('bold').tagName).toBe('STRONG');
    });

    it('does not show any notice or toggle', () => {
      render(<MessageText text="hello" metadata={{}} />);

      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.queryByText('Warning')).toBeNull();
      expect(screen.queryByText('Error')).toBeNull();
    });
  });
});
