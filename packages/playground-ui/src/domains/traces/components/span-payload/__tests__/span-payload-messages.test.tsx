// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SpanInputRenderer } from '../span-input-renderers';
import { SpanPayloadMessages } from '../span-payload-messages';
import { agentRunMessagesSpan } from './fixtures/span-payloads';

afterEach(cleanup);

describe('SpanPayloadMessages', () => {
  describe('when a tool message contains labeled results', () => {
    it('shows Tool result without a redundant Tool heading', () => {
      render(<SpanInputRenderer span={agentRunMessagesSpan} />);
      expect(screen.getByText('Tool result')).toBeTruthy();
      expect(screen.queryByText('tool', { exact: true })).toBeNull();
    });
  });
  describe('when a tool message only has summary text', () => {
    it('keeps the tool role visible', () => {
      render(<SpanPayloadMessages value={[{ role: 'tool', content: 'Recorded summary' }]} />);
      expect(screen.getByText('tool', { exact: true })).toBeTruthy();
    });
  });
  describe('when a system prompt is long and indented', () => {
    it('shows the entire prompt as prose rather than a collapsed card or code', () => {
      const text = `    You are Michel.\n${'    Use the available ingredients and explain each step.\n'.repeat(12)}`;
      const { container } = render(<SpanPayloadMessages value={[{ role: 'system', content: text }]} />);
      expect(container.querySelector('pre')).toBeNull();
      expect(container.querySelector('p')?.textContent).toBe(text.trim());
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
  describe('when user and assistant messages are recorded', () => {
    it('uses conversation messages in their original order', () => {
      const { container } = render(
        <SpanPayloadMessages
          value={[
            { role: 'user', content: 'Hello Michel' },
            { role: 'assistant', content: 'Hello there' },
          ]}
        />,
      );
      expect(screen.getByText('Hello Michel')).toBeTruthy();
      expect(
        Array.from(container.querySelectorAll('[data-slot="message"]'), node => node.getAttribute('data-from')),
      ).toEqual(['user', 'assistant']);
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
});
