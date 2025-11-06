import { beforeEach, describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../agent';
import { buildSpanTree, transformTraceToScorerInputAndOutput, validateTrace } from './utils';

/**
 * Helper to extract text content from MastraDBMessage
 * Matches the logic used in MessageList.mastraDBMessageToAIV4UIMessage
 */
function getTextContent(message: MastraDBMessage): string {
  if (typeof message.content.content === 'string' && message.content.content !== '') {
    return message.content.content;
  }
  if (message.content.parts && Array.isArray(message.content.parts)) {
    // Return only the last text part like AI SDK does
    const textParts = message.content.parts.filter(p => p.type === 'text');
    return textParts.length > 0 ? textParts[textParts.length - 1]?.text || '' : '';
  }
  return '';
}

/**
 * Test utilities for transformer functions - focused on maintainability
 */
class TransformerTestBuilder {
  private spans: any[] = [];
  private traceId: string = 'test-trace-id';

  reset() {
    this.spans = [];
    this.traceId = 'test-trace-id';
    return this;
  }

  withTraceId(traceId: string) {
    this.traceId = traceId;
    return this;
  }

  addAgentSpan(config: {
    spanId: string;
    parentSpanId?: string | null;
    name?: string;
    input?: any;
    output?: any;
    agentId?: string;
    instructions?: string;
    startedAt?: string;
  }) {
    const span = {
      traceId: this.traceId,
      spanId: config.spanId,
      parentSpanId: config.parentSpanId || null,
      name: config.name || `agent run: ${config.spanId}`,
      spanType: 'agent_run',
      startedAt: config.startedAt || '2025-01-01T00:00:00Z',
      input: config.input || 'Test input',
      output: config.output || { text: 'Test output', files: [] },
      attributes: {
        agentId: config.agentId || 'test-agent',
        instructions: config.instructions || 'Test instructions',
      },
    };
    this.spans.push(span);
    return this;
  }

  addLLMSpan(config: {
    spanId: string;
    parentSpanId: string;
    name?: string;
    messages?: Array<{ role: string; content: string }>;
    output?: any;
    startedAt?: string;
  }) {
    const span = {
      traceId: this.traceId,
      spanId: config.spanId,
      parentSpanId: config.parentSpanId,
      name: config.name || `llm: ${config.spanId}`,
      spanType: 'model_generation',
      startedAt: config.startedAt || '2025-01-01T00:01:00Z',
      input: {
        messages: config.messages || [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' },
        ],
      },
      output: config.output || {
        text: 'Hello! How can I help you?',
        reasoning: [],
        files: [],
        sources: [],
        warnings: [],
      },
    };
    this.spans.push(span);
    return this;
  }

  addToolSpan(config: {
    spanId: string;
    parentSpanId: string;
    toolId?: string;
    input?: any;
    output?: any;
    startedAt?: string;
  }) {
    const span = {
      traceId: this.traceId,
      spanId: config.spanId,
      parentSpanId: config.parentSpanId,
      name: `tool: ${config.toolId || 'test-tool'}`,
      spanType: 'tool_call',
      startedAt: config.startedAt || '2025-01-01T00:02:00Z',
      input: config.input || { query: 'test' },
      output: config.output || { result: 'success' },
      attributes: {
        toolId: config.toolId || 'test-tool',
        toolDescription: 'Test tool description',
        toolType: 'function',
      },
    };
    this.spans.push(span);
    return this;
  }

  buildTrace(): any {
    return {
      traceId: this.traceId,
      spans: this.spans,
    };
  }

  buildSpanTree() {
    return buildSpanTree(this.spans);
  }
}

/**
 * Pre-configured test scenarios for common use cases
 */
class TransformerTestScenarios {
  static simpleAgentConversation() {
    return new TransformerTestBuilder()
      .addAgentSpan({
        spanId: 'agent-1',
        input: [{ role: 'user', content: 'Hello, how are you?' }],
        output: { text: 'I am doing well, thank you!', files: [] },
      })
      .addLLMSpan({
        spanId: 'llm-1',
        parentSpanId: 'agent-1',
        messages: [
          { role: 'system', content: 'You are a friendly assistant' },
          { role: 'user', content: 'Hello, how are you?' },
        ],
      });
  }

  static agentWithToolCalls() {
    return new TransformerTestBuilder()
      .addAgentSpan({
        spanId: 'agent-1',
        input: [{ role: 'user', content: 'What is the weather?' }],
        output: { text: 'The weather is sunny with 72°F', files: [] },
      })
      .addLLMSpan({
        spanId: 'llm-1',
        parentSpanId: 'agent-1',
        messages: [
          { role: 'system', content: 'You can check weather' },
          { role: 'user', content: 'What is the weather?' },
        ],
      })
      .addToolSpan({
        spanId: 'tool-1',
        parentSpanId: 'agent-1',
        toolId: 'weatherAPI',
        input: { location: 'Seattle' },
        output: { temperature: 72, condition: 'sunny' },
      });
  }

  static conversationWithMemory() {
    return new TransformerTestBuilder()
      .addAgentSpan({
        spanId: 'agent-1',
        input: [{ role: 'user', content: 'What did I ask before?' }],
        output: { text: 'You asked about the weather', files: [] },
      })
      .addLLMSpan({
        spanId: 'llm-1',
        parentSpanId: 'agent-1',
        messages: [
          { role: 'system', content: 'You remember conversations' },
          { role: 'user', content: 'What is the weather?' },
          { role: 'assistant', content: 'The weather is sunny' },
          { role: 'user', content: 'What did I ask before?' },
        ],
      });
  }

  static nestedAgents() {
    return new TransformerTestBuilder()
      .addAgentSpan({
        spanId: 'root-agent',
        input: [{ role: 'user', content: 'Complex task' }],
        output: { text: 'Task completed', files: [] },
      })
      .addAgentSpan({
        spanId: 'sub-agent',
        parentSpanId: 'root-agent',
        input: [{ role: 'user', content: 'Subtask' }],
        output: { text: 'Subtask done', files: [] },
      })
      .addLLMSpan({
        spanId: 'llm-1',
        parentSpanId: 'sub-agent',
        messages: [
          { role: 'system', content: 'Handle subtasks' },
          { role: 'user', content: 'Subtask' },
        ],
      });
  }

  static invalidTrace() {
    return new TransformerTestBuilder().addLLMSpan({
      spanId: 'llm-only',
      parentSpanId: 'nonexistent-parent',
      messages: [{ role: 'user', content: 'This should fail' }],
    });
  }
}

describe('Transformer Functions', () => {
  let testBuilder: TransformerTestBuilder;

  beforeEach(() => {
    testBuilder = new TransformerTestBuilder();
  });

  describe('buildSpanTree', () => {
    it('should build correct span tree structure', () => {
      const scenario = TransformerTestScenarios.simpleAgentConversation();
      const spanTree = scenario.buildSpanTree();

      expect(spanTree.spanMap.size).toBe(2);
      expect(spanTree.rootSpans).toHaveLength(1);
      expect(spanTree.rootSpans[0]?.spanId).toBe('agent-1');
      expect(spanTree.childrenMap.get('agent-1')).toHaveLength(1);
    });

    it('should handle nested agents correctly', () => {
      const scenario = TransformerTestScenarios.nestedAgents();
      const spanTree = scenario.buildSpanTree();

      expect(spanTree.rootSpans).toHaveLength(1);
      expect(spanTree.rootSpans[0]?.spanId).toBe('root-agent');

      const rootChildren = spanTree.childrenMap.get('root-agent');
      expect(rootChildren).toHaveLength(1);
      expect(rootChildren?.[0]?.spanId).toBe('sub-agent');

      const subChildren = spanTree.childrenMap.get('sub-agent');
      expect(subChildren).toHaveLength(1);
      expect(subChildren?.[0]?.spanId).toBe('llm-1');
    });

    it('should sort children by startedAt timestamp', () => {
      const builder = new TransformerTestBuilder()
        .addAgentSpan({ spanId: 'agent-1' })
        .addLLMSpan({
          spanId: 'llm-1',
          parentSpanId: 'agent-1',
          startedAt: '2025-01-01T00:03:00Z',
        })
        .addToolSpan({
          spanId: 'tool-1',
          parentSpanId: 'agent-1',
          startedAt: '2025-01-01T00:01:00Z',
        });

      const spanTree = builder.buildSpanTree();
      const children = spanTree.childrenMap.get('agent-1');

      expect(children?.[0]?.spanId).toBe('tool-1'); // Earlier timestamp
      expect(children?.[1]?.spanId).toBe('llm-1'); // Later timestamp
    });
  });

  describe('validateTrace', () => {
    it('should pass for valid traces', () => {
      const trace = TransformerTestScenarios.simpleAgentConversation().buildTrace();
      expect(() => validateTrace(trace)).not.toThrow();
    });

    it('should throw for null trace', () => {
      expect(() => validateTrace(null as any)).toThrow('Trace is null or undefined');
    });

    it('should throw for trace with no spans', () => {
      const trace = { traceId: 'test', spans: [] };
      expect(() => validateTrace(trace)).toThrow('Trace has no spans');
    });

    it('should throw for spans with invalid parent references', () => {
      const trace = TransformerTestScenarios.invalidTrace().buildTrace();
      expect(() => validateTrace(trace)).toThrow('references non-existent parent');
    });
  });

  describe('transformTraceToScorerInputAndOutput - Input', () => {
    it('should extract input messages correctly', () => {
      const trace = TransformerTestScenarios.simpleAgentConversation().buildTrace();
      const result = transformTraceToScorerInputAndOutput(trace);

      expect(result.input.inputMessages).toHaveLength(1);
      expect(getTextContent(result.input.inputMessages[0]!)).toBe('Hello, how are you?');
      expect(result.input.inputMessages[0]?.role).toBe('user');
    });

    it('should extract system messages correctly', () => {
      const trace = TransformerTestScenarios.simpleAgentConversation().buildTrace();
      const result = transformTraceToScorerInputAndOutput(trace);

      expect(result.input.systemMessages).toHaveLength(1);
      expect(result.input.systemMessages[0]?.content).toBe('You are a friendly assistant');
      expect(result.input.systemMessages[0]?.role).toBe('system');
    });

    it('should extract conversation memory correctly', () => {
      const trace = TransformerTestScenarios.conversationWithMemory().buildTrace();
      const result = transformTraceToScorerInputAndOutput(trace);

      expect(result.input.rememberedMessages).toHaveLength(2);
      expect(getTextContent(result.input.rememberedMessages[0]!)).toBe('What is the weather?');
      expect(result.input.rememberedMessages[0]?.role).toBe('user');
      expect(getTextContent(result.input.rememberedMessages[1]!)).toBe('The weather is sunny');
      expect(result.input.rememberedMessages[1]?.role).toBe('assistant');
    });

    it('should handle string input format', () => {
      const trace = testBuilder
        .addAgentSpan({
          spanId: 'agent-1',
          input: 'Simple string input',
        })
        .addLLMSpan({
          spanId: 'llm-1',
          parentSpanId: 'agent-1',
        })
        .buildTrace();

      const result = transformTraceToScorerInputAndOutput(trace);
      expect(result.input.inputMessages).toHaveLength(1);
      expect(getTextContent(result.input.inputMessages[0]!)).toBe('Simple string input');
    });

    it('should throw for trace without agent span', () => {
      const trace = testBuilder
        .addLLMSpan({
          spanId: 'llm-only',
          parentSpanId: 'nonexistent',
        })
        .buildTrace();

      expect(() => transformTraceToScorerInputAndOutput(trace)).toThrow();
    });
  });

  describe('transformTraceToScorerInputAndOutput - Output', () => {
    it('should create assistant response message', () => {
      const trace = TransformerTestScenarios.simpleAgentConversation().buildTrace();
      const result = transformTraceToScorerInputAndOutput(trace);

      expect(result.output).toHaveLength(1);
      expect(result.output[0]?.role).toBe('assistant');
      expect(getTextContent(result.output[0]!)).toBe('I am doing well, thank you!');
    });

    it('should include tool invocations in response', () => {
      const trace = TransformerTestScenarios.agentWithToolCalls().buildTrace();
      const result = transformTraceToScorerInputAndOutput(trace);

      expect(result.output[0]?.content.toolInvocations).toHaveLength(1);
      expect(result.output[0]?.content.toolInvocations?.[0]?.toolName).toBe('weatherAPI');
      expect(result.output[0]?.content.toolInvocations?.[0]?.args).toEqual({ location: 'Seattle' });

      // @ts-ignore
      expect(result.output[0]?.content.toolInvocations?.[0]?.result).toEqual({ temperature: 72, condition: 'sunny' });
    });

    it('should include both tool invocation and text parts', () => {
      const trace = TransformerTestScenarios.agentWithToolCalls().buildTrace();
      const result = transformTraceToScorerInputAndOutput(trace);

      const parts = result.output[0]?.content.parts;
      expect(parts).toHaveLength(2); // 1 tool invocation + 1 text

      const toolPart = parts?.find(p => p.type === 'tool-invocation');
      const textPart = parts?.find(p => p.type === 'text');

      expect(toolPart).toBeDefined();
      expect(textPart).toBeDefined();
      expect(textPart?.text).toBe('The weather is sunny with 72°F');
    });
  });

  describe('Error handling', () => {
    it('should provide descriptive error messages', () => {
      const invalidTrace = { traceId: 'test', spans: [] };

      expect(() => transformTraceToScorerInputAndOutput(invalidTrace)).toThrow(/Trace has no spans/);
    });

    it('should handle missing model spans gracefully', () => {
      const trace = testBuilder.addAgentSpan({ spanId: 'agent-only' }).buildTrace();

      expect(() => transformTraceToScorerInputAndOutput(trace)).toThrow('No model generation span found');
    });
  });

  describe('transformTraceToScorerInputAndOutput - Combined', () => {
    it('should return both input and output in a single call', () => {
      const trace = TransformerTestScenarios.simpleAgentConversation().buildTrace();
      const result = transformTraceToScorerInputAndOutput(trace);

      // Verify input structure
      expect(result.input).toBeDefined();
      expect(result.input.inputMessages).toHaveLength(1);
      expect(getTextContent(result.input.inputMessages[0]!)).toBe('Hello, how are you?');
      expect(result.input.systemMessages).toHaveLength(1);
      expect(result.input.systemMessages[0]?.content).toBe('You are a friendly assistant');

      // Verify output structure
      expect(result.output).toBeDefined();
      expect(result.output).toHaveLength(1);
      expect(result.output[0]?.role).toBe('assistant');
      expect(getTextContent(result.output[0]!)).toBe('I am doing well, thank you!');
    });

    it('should handle tool calls in both input and output', () => {
      const trace = TransformerTestScenarios.agentWithToolCalls().buildTrace();
      const result = transformTraceToScorerInputAndOutput(trace);

      // Input should have the user message
      expect(getTextContent(result.input.inputMessages[0]!)).toBe('What is the weather?');

      // Output should have tool invocations
      expect(result.output[0]?.content.toolInvocations).toHaveLength(1);
      expect(result.output[0]?.content.toolInvocations?.[0]?.toolName).toBe('weatherAPI');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty tool invocations', () => {
      const trace = TransformerTestScenarios.simpleAgentConversation().buildTrace();
      const result = transformTraceToScorerInputAndOutput(trace);

      expect(result.output[0]?.content.toolInvocations).toHaveLength(0);
      expect(result.output[0]?.content.parts?.filter(p => p.type === 'tool-invocation')).toHaveLength(0);
    });

    it('should handle complex nested message content', () => {
      const trace = testBuilder
        .addAgentSpan({ spanId: 'agent-1' })
        .addLLMSpan({
          spanId: 'llm-1',
          parentSpanId: 'agent-1',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'First part' },
                { type: 'text', text: 'Second part' },
              ] as any,
            },
          ],
        })
        .buildTrace();

      const result = transformTraceToScorerInputAndOutput(trace);
      expect(getTextContent(result.input.inputMessages[0]!)).toBe('Test input');
      expect(getTextContent(result.input.rememberedMessages[0]!)).toBe('Second part'); // AI SDK convention: last text part only
    });
  });
});
