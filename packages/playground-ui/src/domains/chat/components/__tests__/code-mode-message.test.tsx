// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeModeMessage } from '../code-mode-message';

afterEach(cleanup);

describe('CodeModeMessage', () => {
  describe('when a completed program has logs', () => {
    it('reveals the execution output without application providers', () => {
      render(
        <CodeModeMessage
          toolCallId="code-1"
          toolName="execute_typescript"
          code="return 42"
          result={{ success: true, result: '42', logs: ['finished'] }}
          isRunning={false}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /execute_typescript/ }));
      expect(screen.getByTestId('code-mode-result').textContent).toBe('42');
      expect(screen.getByTestId('code-mode-logs').textContent).toBe('finished');
    });
  });
  describe('when only refusal is available', () => {
    it('delegates refusal without exposing approval', () => {
      const onDecline = vi.fn();
      render(
        <CodeModeMessage
          toolCallId="code-1"
          toolName="execute_typescript"
          code="return 42"
          isRunning={false}
          approvalRequired
          onDecline={onDecline}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
      expect(onDecline).toHaveBeenCalledOnce();
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });
  });
});
