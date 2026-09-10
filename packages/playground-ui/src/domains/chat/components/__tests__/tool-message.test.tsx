// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolMessage } from '../tool-message';

afterEach(cleanup);

describe('ToolMessage', () => {
  describe('when an approval is pending without action callbacks', () => {
    it('shows the arguments without offering a decision', () => {
      render(
        <ToolMessage
          toolName="weather"
          toolCallId="call-1"
          args={{ city: 'Paris' }}
          result={undefined}
          toolOutput={[]}
          isRunning={false}
          approvalRequired
        />,
      );
      expect(screen.getByTestId('tool-args').textContent).toContain('Paris');
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
    });
  });
  describe('when only approval is supplied', () => {
    it('delegates approval without adding a refusal action', () => {
      const onApprove = vi.fn();
      render(
        <ToolMessage
          toolName="weather"
          toolCallId="call-1"
          args={{ city: 'Paris' }}
          result={undefined}
          toolOutput={[]}
          isRunning={false}
          approvalRequired
          onApprove={onApprove}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      expect(onApprove).toHaveBeenCalledOnce();
      expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
    });
  });
  describe('when a completed tool is expanded', () => {
    it('reveals its output without application providers', () => {
      render(
        <ToolMessage
          toolName="weather"
          toolCallId="call-1"
          args={{ city: 'Paris' }}
          result="Sunny"
          toolOutput={[]}
          isRunning={false}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /weather/i }));
      expect(screen.getByTestId('tool-result').textContent).toBe('Sunny');
    });
  });
});
