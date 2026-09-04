import { describe, expect, it } from 'vitest';

import { formatTraceThreadMessages } from '../format-trace-thread-messages';
import { agentTraceWithTools, basicAgentTrace } from './fixtures/trace-thread-item';

describe('formatTraceThreadMessages', () => {
  describe('when an agent trace contains one user input and a text response', () => {
    it('returns the corresponding chat turn', () => {
      const messages = formatTraceThreadMessages(basicAgentTrace.spans);

      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({
        role: 'user',
        content: { parts: [{ type: 'text', text: 'Plan a weekend in Paris' }] },
      });
      expect(messages[1]).toMatchObject({
        role: 'assistant',
        content: { parts: [{ type: 'text', text: 'Your Paris itinerary is ready.' }] },
      });
    });
  });

  describe('when an agent turn contains different kinds of tool calls', () => {
    it('includes each visible tool once in chronological order', () => {
      const messages = formatTraceThreadMessages(agentTraceWithTools.spans);
      const toolNames = messages[1]?.content.parts.flatMap(part =>
        part.type === 'tool-invocation' ? [part.toolInvocation.toolName] : [],
      );

      expect(toolNames).toEqual(['workflow-tripPlanner', 'searchHotels', 'browser_location', 'web_search']);
    });

    it('remembers which spans were used to build each message: tools, their top-level execution, and the text chunks but not reasoning', () => {
      const messages = formatTraceThreadMessages(agentTraceWithTools.spans);

      expect(messages[0]?.traceSpanIds).toEqual(['agent-root']);
      expect(messages[1]?.traceSpanIds).toEqual([
        'agent-root',
        'workflow-tool',
        'workflow-run',
        'mcp-tool',
        'client-tool',
        'provider-tool',
        'text-chunk',
      ]);
      expect(messages[0]?.content.metadata).toBeUndefined();
      expect(messages[1]?.content.metadata).toBeUndefined();
    });
  });

  describe('when the user input contains persisted message parts', () => {
    it('preserves text and file parts for the chat renderer', () => {
      const spans = basicAgentTrace.spans.map(span => ({
        ...span,
        input: {
          messages: [
            {
              role: 'user',
              content: {
                format: 2,
                parts: [
                  { type: 'text', text: 'Inspect this map' },
                  { type: 'file', mimeType: 'image/png', data: 'https://example.com/map.png' },
                ],
              },
            },
          ],
        },
      }));

      const messages = formatTraceThreadMessages(spans);

      expect(messages[0]?.content.parts).toEqual([
        { type: 'text', text: 'Inspect this map' },
        { type: 'file', mimeType: 'image/png', data: 'https://example.com/map.png' },
      ]);
    });
  });

  describe('when a thread signal triggered the agent trace', () => {
    it('renders the signal contents as the user message', () => {
      const spans = basicAgentTrace.spans.map(span => ({
        ...span,
        input: {
          __isCreatedSignal: true,
          id: 'user-signal-1',
          type: 'user',
          tagName: 'user',
          contents: [{ type: 'text', text: 'Plan a weekend in Paris' }],
          createdAt: new Date('2026-08-30T12:00:00.000Z'),
        },
      }));

      const messages = formatTraceThreadMessages(spans);

      expect(messages[0]?.content.parts).toEqual([{ type: 'text', text: 'Plan a weekend in Paris' }]);
    });
  });

  describe('when the agent returns structured output without text', () => {
    it('renders the structured result as the assistant response', () => {
      const spans = basicAgentTrace.spans.map(span => ({ ...span, output: { object: { city: 'Paris', days: 2 } } }));

      const messages = formatTraceThreadMessages(spans);

      expect(messages[1]?.content.parts).toEqual([{ type: 'text', text: '{"city":"Paris","days":2}' }]);
    });
  });
});
