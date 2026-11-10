/**
 * @vitest-environment jsdom
 */
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { MessageRow } from '../shared/tool-call-row';

const message = (role: 'user' | 'assistant', parts: unknown[]) =>
  ({ id: role, role, createdAt: new Date(), content: { format: 2, parts } }) as unknown as MastraDBMessage;

// A trace's thread view is a conversation: the stand-in must keep its text, not only its tool calls.
it("draws a thread's user and assistant text along with its tool calls", () => {
  render(
    <>
      <MessageRow message={message('user', [{ type: 'text', text: 'Where is order 1042?' }])} readOnly />
      <MessageRow
        message={message('assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: { toolName: 'lookupOrder', args: { orderId: '1042' }, result: { carrier: 'DHL' } },
          },
          { type: 'text', text: 'It shipped with DHL.' },
        ])}
        readOnly
        footer={<button>Highlight spans</button>}
      />
    </>,
  );

  expect(screen.getByText('Where is order 1042?')).toBeTruthy();
  expect(screen.getByText('It shipped with DHL.')).toBeTruthy();
  expect(screen.getByText('lookupOrder')).toBeTruthy();
  expect(screen.getByText(/"carrier": "DHL"/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Highlight spans' })).toBeTruthy();
});
