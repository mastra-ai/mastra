import { SpanType } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { getSpanOutcome } from '../span-outcome.utils';
import {
  agentRunAbortedSpan,
  agentRunTripwireSpan,
  errorSpan,
  makeSpan,
  modelGenerationSpan,
  processorClearedMessagesSpan,
  processorInputSpan,
  processorOutputStreamSpan,
  processorSystemMutationSpan,
  processorToolResultSpan,
  processorTripwireSpan,
  toolCallSpan,
  workflowStepSpan,
} from '../span-payload/__tests__/fixtures/span-payloads';

const conversation = {
  messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
  systemMessages: [{ role: 'system', content: 'You are a weather assistant.' }],
  stepNumber: 0,
  retryCount: 0,
};

describe('getSpanOutcome', () => {
  describe('pipeline spans lead with what they changed, and fold their payloads', () => {
    it('counts the messages a memory recall brought back', () => {
      const span = makeSpan({
        spanType: SpanType.MEMORY_OPERATION,
        name: 'memory: recall',
        attributes: {
          operationType: 'recall',
          processorPhase: 'input',
          processorExecutor: 'workflow',
          processorIndex: 0,
          messageListMutations: [
            { type: 'add', source: 'memory', count: 2 },
            { type: 'clear', source: 'input', count: 1 },
          ],
        },
        input: conversation,
        output: conversation,
      });

      expect(getSpanOutcome(span)).toEqual({
        headline: 'Loaded 2 earlier messages from memory into the conversation',
        tone: 'change',
        evidence: 'changes',
      });
    });

    it('says so when memory had nothing to recall', () => {
      const span = makeSpan({
        spanType: SpanType.MEMORY_OPERATION,
        attributes: { operationType: 'recall', processorPhase: 'input', messageListMutations: [] },
        input: conversation,
        output: conversation,
      });

      expect(getSpanOutcome(span)).toMatchObject({ headline: 'Found no earlier messages in memory', tone: 'neutral' });
    });

    it('counts the messages a memory save persisted', () => {
      const span = makeSpan({
        spanType: SpanType.MEMORY_OPERATION,
        attributes: { operationType: 'save', processorPhase: 'outputResult' },
        output: { messages: [{ role: 'user' }, { role: 'assistant' }] },
      });

      expect(getSpanOutcome(span)).toMatchObject({ headline: 'Saved 2 messages from this turn to memory' });
    });

    it('names the workspace whose instructions were mounted', () => {
      const span = makeSpan({
        spanType: SpanType.WORKSPACE_ACTION,
        attributes: {
          category: 'mount',
          processorPhase: 'inputStep',
          workspaceName: 'chef-workspace',
          success: true,
          messageListMutations: [{ type: 'addSystem', tag: 'workspace', message: 'Use the kitchen tools.' }],
        },
        input: conversation,
        output: {},
      });

      expect(getSpanOutcome(span)).toMatchObject({
        headline: 'Added the chef-workspace workspace instructions to the system prompt',
        tone: 'change',
      });
    });

    it('counts the skills a skill action injected', () => {
      const span = makeSpan({
        spanType: SpanType.SKILL_ACTION,
        attributes: {
          operation: 'inject',
          processorPhase: 'inputStep',
          skillCount: 3,
          messageListMutations: [{ type: 'addSystem', tag: 'skills' }],
        },
        output: {},
      });

      expect(getSpanOutcome(span)).toMatchObject({
        headline: 'Listed 3 available skills in the system prompt',
        tone: 'change',
      });
    });

    it('describes message list mutations of a generic processor', () => {
      expect(getSpanOutcome({ ...processorSystemMutationSpan, entityName: 'tone-guide' })).toMatchObject({
        headline: 'tone-guide added 1 system message to the prompt',
      });
      expect(getSpanOutcome({ ...processorClearedMessagesSpan, entityName: 'reset' })).toMatchObject({
        headline: 'reset removed 4 messages from the conversation',
      });
    });

    it('says a processor passed the request through when it changed nothing', () => {
      const span = makeSpan({
        spanType: SpanType.PROCESSOR_RUN,
        entityName: 'provider-history-compat',
        attributes: { processorPhase: 'llmRequest', processorExecutor: 'workflow', processorIndex: 0 },
        input: conversation,
        output: { shortCircuited: false },
      });

      expect(getSpanOutcome(span)).toMatchObject({
        headline: 'provider-history-compat ran and left the messages unchanged',
        tone: 'neutral',
      });
      expect(getSpanOutcome(processorToolResultSpan)).toMatchObject({
        headline: 'The processor ran and left the messages unchanged',
      });
    });

    it('warns when a processor short-circuited the request', () => {
      const span = makeSpan({
        spanType: SpanType.PROCESSOR_RUN,
        entityName: 'response-cache',
        attributes: { processorPhase: 'llmRequest' },
        output: { shortCircuited: true },
      });

      expect(getSpanOutcome(span)).toMatchObject({
        headline: 'response-cache returned a response itself, so the model was not called',
        tone: 'warning',
      });
    });

    it('shows the rewritten output when a processor rewrote messages in place', () => {
      const span = makeSpan({
        spanType: SpanType.PROCESSOR_RUN,
        entityName: 'language',
        attributes: { processorPhase: 'input' },
        input: conversation,
        output: { ...conversation, systemMessages: [{ role: 'system', content: 'Answer in French.' }] },
      });

      expect(getSpanOutcome(span)).toMatchObject({
        headline: 'language rewrote the system messages',
        tone: 'change',
        evidence: 'output',
      });
    });

    it('shows the output of a processor whose output is not a message list', () => {
      expect(getSpanOutcome(processorOutputStreamSpan)).toMatchObject({
        headline: 'The processor returned a result and left the messages unchanged',
        evidence: 'output',
      });
    });

    it('surfaces the reason a processor aborted the run', () => {
      expect(getSpanOutcome(processorTripwireSpan)).toMatchObject({
        headline: 'prompt-guard stopped the run',
        detail: 'Prompt injection detected',
        tone: 'error',
        evidence: undefined,
      });
    });
  });

  describe('spans that produce something lead with what they produced', () => {
    it('leads with the reply and names the tools called on the way to it', () => {
      expect(getSpanOutcome(modelGenerationSpan)).toEqual({
        headline: 'gpt-4o called getWeather, then wrote the answer',
        detail: 'It is sunny in Paris.',
        tone: 'success',
        evidence: 'output',
      });
    });

    it('names the tools a step called when it has no reply yet', () => {
      const span = makeSpan({
        spanType: SpanType.MODEL_STEP,
        attributes: { model: 'gpt-5-mini' },
        output: {
          text: '',
          toolCalls: [{ toolName: 'weatherInfo', toolCallId: 'call_1', args: { location: 'Paris' } }],
        },
      });
      expect(getSpanOutcome(span)).toMatchObject({ headline: 'gpt-5-mini asked to call weatherInfo', tone: 'success' });
    });

    it.each([
      [['weatherInfo', 'weatherInfo', 'weatherInfo'], 'gpt-5-mini called weatherInfo 3 times, then wrote the answer'],
      [['weatherInfo', 'search'], 'gpt-5-mini called weatherInfo and search, then wrote the answer'],
      [['weatherInfo', 'weatherInfo', 'search'], 'gpt-5-mini called 3 tools, then wrote the answer'],
      [['a', 'b', 'c', 'd', 'e'], 'gpt-5-mini called 5 tools, then wrote the answer'],
    ])('summarises the tool calls made across steps: %j', (names, headline) => {
      const span = makeSpan({
        spanType: SpanType.MODEL_GENERATION,
        attributes: { model: 'gpt-5-mini' },
        output: {
          text: 'Done.',
          toolCalls: names.map((toolName, index) => ({ toolName, toolCallId: `call_${index}`, args: {} })),
        },
      });
      expect(getSpanOutcome(span)?.headline).toBe(headline);
    });

    it('counts the calls of a step that has no reply yet', () => {
      const span = makeSpan({
        spanType: SpanType.MODEL_STEP,
        output: {
          text: '',
          toolCalls: ['a', 'b', 'c'].map((toolName, index) => ({ toolName, toolCallId: `call_${index}`, args: {} })),
        },
      });
      expect(getSpanOutcome(span)?.headline).toBe('The model asked to call 3 tools');
    });

    it('warns when a model stopped at the token limit', () => {
      const span = makeSpan({
        spanType: SpanType.MODEL_GENERATION,
        attributes: { model: 'gpt-5-mini', finishReason: 'length' },
        output: { text: 'The answer is' },
      });

      expect(getSpanOutcome(span)).toMatchObject({
        headline: 'gpt-5-mini hit its output token limit, so the answer is cut off',
        tone: 'warning',
      });
    });

    it('previews the arguments and result of a tool call', () => {
      expect(getSpanOutcome({ ...toolCallSpan, entityName: 'getWeather' })).toEqual({
        headline: 'getWeather ran with city: Paris · units: metric and returned a result',
        detail: 'temperature: 21 · condition: sunny · humidity: 40',
        tone: 'success',
        evidence: 'output',
      });
    });

    it('quotes the agent reply', () => {
      const span = makeSpan({
        spanType: SpanType.AGENT_RUN,
        entityName: 'weather-agent',
        input: [{ role: 'user', content: 'What is the weather in Paris?' }],
        output: { text: 'It is 16°C and overcast in Paris.\n\nAnything else?' },
      });

      expect(getSpanOutcome(span)).toMatchObject({
        headline: 'weather-agent answered “What is the weather in Paris?”',
        detail: 'It is 16°C and overcast in Paris.',
        tone: 'success',
      });
    });

    it('names the processor that blocked an agent run', () => {
      expect(getSpanOutcome(agentRunTripwireSpan)).toMatchObject({
        headline: 'prompt-guard blocked the run before the agent could answer',
        detail: 'Prompt injection detected',
        tone: 'error',
      });
    });

    it('warns when an agent run was aborted', () => {
      expect(getSpanOutcome(agentRunAbortedSpan)).toMatchObject({
        headline: 'The run was aborted before the agent finished',
        detail: 'Client disconnected',
        tone: 'warning',
      });
    });

    it('previews what a chunk streamed', () => {
      const text = makeSpan({
        spanType: SpanType.MODEL_CHUNK,
        attributes: { chunkType: 'text' },
        output: { text: 'Overcast, 16°C' },
      });
      const toolCall = makeSpan({
        spanType: SpanType.MODEL_CHUNK,
        attributes: { chunkType: 'tool-call' },
        output: { toolName: 'weatherInfo', toolCallId: 'call-1', toolInput: { location: 'Paris' } },
      });

      expect(getSpanOutcome(text)).toMatchObject({ headline: 'Streamed part of the answer', detail: 'Overcast, 16°C' });
      expect(getSpanOutcome(toolCall)).toMatchObject({ headline: 'Streamed the request to call weatherInfo' });
    });
  });

  it('leads a failed span with its failure, leaving the message to the Error section', () => {
    expect(getSpanOutcome(errorSpan)).toMatchObject({ headline: 'getWeather failed', tone: 'error' });
    expect(getSpanOutcome(errorSpan)?.detail).toBeUndefined();
  });

  it('has no outcome for spans it cannot describe', () => {
    expect(getSpanOutcome(workflowStepSpan)).toBeUndefined();
  });
});
