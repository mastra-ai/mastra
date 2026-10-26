// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  describe('when a system prompt is indented', () => {
    it('shows the prompt as prose rather than code', () => {
      const text = `    You are Michel.\n${'    Use the available ingredients and explain each step.\n'.repeat(12)}`;
      const { container } = render(<SpanPayloadMessages value={[{ role: 'system', content: text }]} />);
      expect(container.querySelector('pre')).toBeNull();
      expect(container.querySelector('p')?.textContent).toBe(text.replace(/^ {4}/gm, '').trim());
    });
  });
  describe('when a system prompt contains markdown', () => {
    it('renders it formatted instead of showing raw markdown', () => {
      const { container } = render(
        <SpanPayloadMessages value={[{ role: 'system', content: '  # Title\n\n  **bold**\n\n  - item' }]} />,
      );
      expect(container.querySelector('h1')?.textContent).toBe('Title');
      expect(container.querySelector('strong')?.textContent).toBe('bold');
      expect(container.querySelector('li')?.textContent).toBe('item');
      expect(container.querySelector('pre')).toBeNull();
      expect(container.textContent).not.toMatch(/\*\*|#/);
    });
  });
  describe('when an assistant message is recorded as memory stores it', () => {
    const storedAssistant = (reasoning: Record<string, unknown>) => ({
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          { type: 'reasoning', ...reasoning },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'call_1',
              toolName: 'weatherInfo',
              args: { city: 'Paris' },
              result: { temperature: 11.9 },
            },
          },
          { type: 'step-start', createdAt: 1793014088036 },
          { type: 'text', text: 'Current weather in Paris' },
        ],
      },
    });
    const json = (container: HTMLElement) => container.querySelectorAll('[data-slot="span-payload-json"]');

    it('draws the tool call and the answer, without raw JSON for the step boundary or an empty reasoning', () => {
      const { container } = render(
        <SpanPayloadMessages
          value={[
            storedAssistant({
              reasoning: '',
              details: [{ type: 'text', text: '' }],
              providerMetadata: { openai: { reasoningEncryptedContent: 'gAAAAB' } },
            }),
          ]}
        />,
      );
      expect(json(container)).toHaveLength(0);
      expect(screen.queryByRole('button', { name: 'Reasoning' })).toBeNull();
      expect(container.querySelectorAll('[data-slot="span-payload-tool"]')).toHaveLength(1);
      expect(screen.queryByText('Tool call')).toBeNull();
      expect(screen.getByText('Current weather in Paris')).toBeTruthy();
      expect(container.textContent).not.toContain('gAAAAB');
    });

    it('shows the reasoning the model summarized', () => {
      const { container } = render(
        <SpanPayloadMessages
          value={[
            storedAssistant({
              reasoning: 'Look up the weather first.',
              details: [{ type: 'text', text: 'Look up the weather first.' }],
            }),
          ]}
        />,
      );
      expect(json(container)).toHaveLength(0);
      expect(screen.getByText('Look up the weather first.')).toBeTruthy();
    });

    it('says when the provider redacted the reasoning', () => {
      render(
        <SpanPayloadMessages
          value={[storedAssistant({ reasoning: '', details: [{ type: 'redacted', data: 'opaque' }] })]}
        />,
      );
      expect(screen.getByText('Reasoning was redacted by the provider.')).toBeTruthy();
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
