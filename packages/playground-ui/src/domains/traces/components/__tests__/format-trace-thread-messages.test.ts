// @vitest-environment jsdom
import { SpanType } from '@mastra/core/observability';
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
    it('renders one assistant message per tool call in chronological order, followed by the text response', () => {
      const messages = formatTraceThreadMessages(agentTraceWithTools.spans);

      expect(messages.map(message => message.role)).toEqual([
        'user',
        'assistant',
        'assistant',
        'assistant',
        'assistant',
        'assistant',
      ]);
      const toolNames = messages
        .slice(1, 5)
        .map(message =>
          message.content.parts.map(part =>
            part.type === 'tool-invocation' ? part.toolInvocation.toolName : part.type,
          ),
        );
      expect(toolNames).toEqual([['workflow-tripPlanner'], ['searchHotels'], ['browser_location'], ['web_search']]);
      expect(messages[5]?.content.parts).toEqual([{ type: 'text', text: 'Your Paris itinerary is ready.' }]);
    });

    it('remembers which spans were used to build each message: a tool with its top-level execution, and the text chunks but not reasoning', () => {
      const messages = formatTraceThreadMessages(agentTraceWithTools.spans);

      expect(messages[0]?.traceSpanIds).toEqual(['agent-root']);
      expect(messages[1]?.traceSpanIds).toEqual(['agent-root', 'workflow-tool', 'workflow-run']);
      expect(messages[2]?.traceSpanIds).toEqual(['agent-root', 'mcp-tool']);
      expect(messages[3]?.traceSpanIds).toEqual(['agent-root', 'client-tool']);
      expect(messages[4]?.traceSpanIds).toEqual(['agent-root', 'provider-tool']);
      expect(messages[5]?.traceSpanIds).toEqual(['agent-root', 'text-chunk']);
      expect(messages.every(message => message.content.metadata === undefined)).toBe(true);
    });

    it('omits the text message when the agent turn ends without a text response', () => {
      const spans = agentTraceWithTools.spans.map(span =>
        span.spanId === 'agent-root' ? { ...span, output: {} } : span,
      );

      const messages = formatTraceThreadMessages(spans);

      expect(messages).toHaveLength(5);
      expect(
        messages.every(message => message.role === 'user' || message.content.parts[0]?.type === 'tool-invocation'),
      ).toBe(true);
    });
  });

  describe('when a suspended tool call is resumed under the same toolCallId', () => {
    it('renders one tool message carrying the resumed result and both spans', () => {
      const client = agentTraceWithTools.spans.find(span => span.spanId === 'client-tool');
      if (!client) throw new Error('fixture missing client-tool span');
      const suspended = {
        ...client,
        attributes: { ...client.attributes, toolCallId: 'call-plan' },
        output: null,
      };
      const resumed = {
        ...client,
        spanId: 'client-tool-resumed',
        startedAt: new Date(new Date(client.startedAt).getTime() + 1000).toISOString(),
        attributes: { ...client.attributes, toolCallId: 'call-plan' },
        output: { approved: true },
      };
      const spans = [...agentTraceWithTools.spans.filter(span => span !== client), resumed, suspended];

      const messages = formatTraceThreadMessages(spans);
      const planMessages = messages.filter(message => message.traceSpanIds.includes('client-tool'));

      expect(planMessages).toHaveLength(1);
      expect(planMessages[0]?.traceSpanIds).toEqual(['agent-root', 'client-tool', 'client-tool-resumed']);
      const part = planMessages[0]?.content.parts[0];
      expect(
        part?.type === 'tool-invocation' && part.toolInvocation.state === 'result' && part.toolInvocation.result,
      ).toEqual({
        approved: true,
      });
    });
  });

  describe('when the agent run suspended and was resumed as a nested agent run', () => {
    it('renders the resumed run response text', () => {
      const root = agentTraceWithTools.spans.find(span => span.spanId === 'agent-root');
      if (!root) throw new Error('fixture missing agent-root span');
      const spans = [
        ...agentTraceWithTools.spans.map(span =>
          span === root ? { ...span, output: { status: 'suspended', toolName: 'submit_plan' } } : span,
        ),
        {
          ...root,
          spanId: 'resumed-run',
          parentSpanId: 'agent-root',
          startedAt: root.endedAt ?? root.startedAt,
          input: { action: 'approved' },
          output: { text: 'Le plan a été soumis.' },
        },
      ];

      const messages = formatTraceThreadMessages(spans);

      expect(messages.at(-1)?.content.parts).toEqual([{ type: 'text', text: 'Le plan a été soumis.' }]);
    });
  });

  describe('when observational memory observed during the run', () => {
    it('renders an observation badge part and never uses the observer output as the reply', () => {
      const root = agentTraceWithTools.spans.find(span => span.spanId === 'agent-root');
      if (!root) throw new Error('fixture missing agent-root span');
      const startedAt = root.endedAt ?? root.startedAt;
      const endedAt = new Date(new Date(startedAt).getTime() + 2000).toISOString();
      const spans = [
        ...agentTraceWithTools.spans.map(span => (span === root ? { ...span, output: { status: 'suspended' } } : span)),
        {
          ...root,
          spanId: 'om-observe',
          parentSpanId: 'agent-root',
          spanType: SpanType.MEMORY_OPERATION,
          name: 'memory: observe',
          startedAt,
          endedAt,
          attributes: { operationType: 'observe', inputTokens: 1223 },
          input: null,
          output: null,
        },
        {
          ...root,
          spanId: 'om-observer-run',
          parentSpanId: 'om-observe',
          startedAt,
          endedAt,
          output: { text: '<observations>\n* User asked for a plan\n</observations>' },
        },
        {
          ...root,
          spanId: 'om-observer-llm',
          parentSpanId: 'om-observer-run',
          spanType: SpanType.MODEL_GENERATION,
          startedAt,
          endedAt,
          output: { text: '<observations>\n* User asked for a plan\n</observations>' },
        },
      ];

      const messages = formatTraceThreadMessages(spans);
      const omMessage = messages.find(message => message.traceSpanIds.includes('om-observe'));
      const part = omMessage?.content.parts[0];

      expect(part?.type === 'tool-invocation' && part.toolInvocation.toolName).toBe('mastra-memory-om-observation');
      expect(part?.type === 'tool-invocation' && part.toolInvocation.args).toMatchObject({
        observations: '* User asked for a plan',
        tokensObserved: 1223,
        durationMs: 2000,
        _state: 'complete',
      });
      expect(JSON.stringify(messages.at(-1)?.content.parts)).not.toContain('<observations>');
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
