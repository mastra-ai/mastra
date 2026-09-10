// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatMessages } from '../chat-messages';
import { chatWorkflow } from './fixtures/workflow';

function toolMessage(toolName: string, result?: unknown): MastraDBMessage {
  return {
    id: 'message',
    role: 'assistant',
    createdAt: new Date('2026-09-10'),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation:
            result === undefined
              ? { state: 'call', toolCallId: 'call', toolName, args: {} }
              : { state: 'result', toolCallId: 'call', toolName, args: {}, result },
        },
      ],
      metadata: { mode: 'stream', requireApprovalMetadata: { [toolName]: { toolCallId: 'call', toolName, args: {} } } },
    },
  };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('ChatMessages tool dispatch', () => {
  describe.each(['onApprove', 'onDecline'] as const)('when only %s is supplied', action => {
    it('exposes only that action and returns the tool identity', () => {
      const callback = vi.fn();
      render(<ChatMessages messages={[toolMessage('search')]} isRunning={false} {...{ [action]: callback }} />);
      const label = action === 'onApprove' ? 'Approve' : 'Decline';
      expect(
        screen.queryByRole('button', { name: action === 'onApprove' ? 'Decline' : 'Approve', exact: true }),
      ).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: label, exact: true }));
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ toolCallId: 'call', toolName: 'search' }));
    });
  });
  describe('when a run waits for approval rather than submitting', () => {
    it('allows the parent to resume it', () => {
      const onApprove = vi.fn();
      render(
        <ChatMessages
          messages={[toolMessage('search')]}
          isRunning
          toolData={{ call: { isSubmitting: false } }}
          onApprove={onApprove}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Approve', exact: true }));
      expect(onApprove).toHaveBeenCalledOnce();
    });
  });
  describe('when a subagent returns child messages', () => {
    it('renders its nested text without application providers', () => {
      render(
        <ChatMessages
          messages={[
            toolMessage('agent-researcher', { childMessages: [{ type: 'text', content: 'Research **completed**' }] }),
          ]}
          isRunning={false}
        />,
      );
      expect(screen.getByText('completed').tagName).toBe('STRONG');
    });
  });
  describe('when workflow data is supplied', () => {
    it('renders the workflow graph without application providers', () => {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
      render(
        <ChatMessages
          messages={[toolMessage('workflow-research', { status: 'success' })]}
          isRunning={false}
          toolData={{ call: { workflow: { workflow: chatWorkflow, isLoading: false } } }}
        />,
      );
      expect(screen.getByText('Research the topic')).toBeTruthy();
    });
  });
  describe('when a submitted plan is returned', () => {
    it('renders the full document without action callbacks', () => {
      render(
        <ChatMessages
          messages={[
            toolMessage('submit_plan', {
              submittedPlan: { plan: '# Migration\n\nPreserve all messages.', path: '/plan.md' },
            }),
          ]}
          isRunning={false}
        />,
      );
      expect(screen.getByText('Preserve all messages.')).toBeTruthy();
    });
  });
  describe('when another tool arrives during streaming', () => {
    it('preserves the expanded state of an existing tool', () => {
      const original = toolMessage('search', 'Found the answer');
      const { rerender } = render(<ChatMessages messages={[original]} isRunning={false} />);
      fireEvent.click(screen.getByRole('button', { name: /search/i }));
      const expanded = screen.getByRole('button', { name: /search/i }).getAttribute('aria-expanded');
      const next = {
        ...original,
        content: {
          ...original.content,
          parts: [
            ...original.content.parts,
            ...toolMessage('fetch').content.parts.map(part =>
              part.type === 'tool-invocation'
                ? { ...part, toolInvocation: { ...part.toolInvocation, toolCallId: 'second-call' } }
                : part,
            ),
          ],
        },
      };
      rerender(<ChatMessages messages={[next]} isRunning={false} />);
      expect(screen.getByRole('button', { name: /search/i }).getAttribute('aria-expanded')).toBe(expanded);
    });
  });
});
