import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../agent/message-list';
import { createSignal } from '../agent/signals';
import { TripWire } from '../agent/trip-wire';
import { CyberRefusalHandler } from './cyber-refusal-handler';
import type { ProcessAPIErrorArgs, ProcessOutputStepArgs } from './index';

const REFUSAL_MESSAGE =
  "This content was flagged for possible cybersecurity risk. If this seems wrong, try rephrasing your request. If you're doing authorized security work that requires more cyber permissive safeguards, apply for Daybreak access via https://platform.openai.com/settings/organization/status-and-access before retrying.";

const createMessage = (content: string, role: 'user' | 'assistant' = 'user') => ({
  id: `msg-${Math.random()}`,
  role,
  content: {
    format: 2 as const,
    parts: [{ type: 'text' as const, text: content }],
  },
  createdAt: new Date(),
});

// Shape produced by @ai-sdk/openai's openaiFailedResponseHandler for a non-2xx response.
function createHttpRefusalError() {
  const body = {
    error: { message: REFUSAL_MESSAGE, type: 'invalid_request_error', param: null, code: 'cyber_policy' },
  };
  return new APICallError({
    message: REFUSAL_MESSAGE,
    url: 'https://api.openai.com/v1/responses',
    requestBodyValues: {},
    statusCode: 400,
    responseBody: JSON.stringify(body),
    data: body,
  });
}

// Shape produced by @ai-sdk/openai's throwIfOpenAIStreamErrorBeforeOutput: an unrecognized
// code maps to status 500, so the SDK marks it retryable.
function createStreamBeforeOutputRefusalError() {
  const frame = {
    type: 'response.failed',
    sequence_number: 2,
    response: { error: { code: 'cyber_policy', message: REFUSAL_MESSAGE } },
  };
  return new APICallError({
    message: REFUSAL_MESSAGE,
    url: 'https://api.openai.com/v1/responses',
    requestBodyValues: {},
    statusCode: 500,
    responseBody: JSON.stringify(frame),
    data: frame,
  });
}

function makeArgs(overrides: Partial<ProcessAPIErrorArgs> = {}): ProcessAPIErrorArgs {
  const messageList = new MessageList({ threadId: 'test-thread' });
  messageList.add([createMessage('fix the failing test', 'user')], 'input');
  messageList.add([createMessage('Looking at the test now.', 'assistant')], 'response');

  return {
    error: createHttpRefusalError(),
    messages: messageList.get.all.db(),
    messageList,
    stepNumber: 3,
    steps: [],
    state: {},
    retryCount: 0,
    abort: (() => {
      throw new Error('abort');
    }) as any,
    sendSignal: async signalInput => {
      const signal = createSignal(signalInput);
      messageList.add(signal.toDBMessage(), 'input');
      return signal;
    },
    ...overrides,
  };
}

describe('CyberRefusalHandler', () => {
  it.each([
    ['an HTTP error response', createHttpRefusalError()],
    ['a stream that failed before output', createStreamBeforeOutputRefusalError()],
    [
      'a nested Responses stream error event',
      {
        type: 'error',
        sequence_number: 5,
        error: { type: 'invalid_request_error', code: 'cyber_policy', message: REFUSAL_MESSAGE },
      },
    ],
    [
      'a flat Responses stream error event',
      { type: 'error', sequence_number: 5, code: 'cyber_policy', message: REFUSAL_MESSAGE },
    ],
    [
      'a response.failed stream event',
      { type: 'response.failed', sequence_number: 5, response: { error: { code: 'cyber_policy', message: 'x' } } },
    ],
    ['an error wrapped in a cause chain', new Error('Stream failed', { cause: createHttpRefusalError() })],
  ])('retries a refusal delivered as %s', async (_label, error) => {
    const handler = new CyberRefusalHandler();

    const result = await handler.processAPIError(makeArgs({ error }));

    expect(result).toEqual({ retry: true });
  });

  it('matches the cyber_policy code when the message differs', async () => {
    const handler = new CyberRefusalHandler();
    const error = { type: 'error', code: 'CYBER_POLICY', message: 'Request blocked.' };

    expect(await handler.processAPIError(makeArgs({ error }))).toEqual({ retry: true });
  });

  it('matches the refusal message when the code is missing', async () => {
    const handler = new CyberRefusalHandler();

    expect(await handler.processAPIError(makeArgs({ error: new Error(`Error: ${REFUSAL_MESSAGE}`) }))).toEqual({
      retry: true,
    });
  });

  it('matches the refusal message when it is only in the response body', async () => {
    const handler = new CyberRefusalHandler();
    const error = new APICallError({
      message: 'Bad Request',
      url: 'https://gateway.example.com/v1/responses',
      requestBodyValues: {},
      statusCode: 400,
      responseBody: JSON.stringify({ error: { message: REFUSAL_MESSAGE } }),
    });

    expect(await handler.processAPIError(makeArgs({ error }))).toEqual({ retry: true });
  });

  it('appends a continue system reminder before retrying', async () => {
    const handler = new CyberRefusalHandler();
    const args = makeArgs();
    const messageCountBefore = args.messageList.get.all.db().length;

    await handler.processAPIError(args);

    const messagesAfter = args.messageList.get.all.db();
    expect(messagesAfter.length).toBe(messageCountBefore + 1);
    const lastMessage = messagesAfter.at(-1)!;
    expect(lastMessage.role).toBe('signal');
    expect(lastMessage.type).toBe('system-reminder');
    expect(lastMessage.content.parts).toEqual([expect.objectContaining({ type: 'text', text: 'continue' })]);
    const signal = lastMessage.content.metadata?.signal as Record<string, unknown>;
    expect(signal).toEqual(expect.objectContaining({ type: 'reactive', tagName: 'system-reminder' }));
    expect(signal).not.toHaveProperty('attributes');
  });

  it('does not retry a second time on the same step', async () => {
    const handler = new CyberRefusalHandler();
    const args = makeArgs({ retryCount: 1 });
    const messageCountBefore = args.messageList.get.all.db().length;

    expect(await handler.processAPIError(args)).toBeUndefined();
    expect(args.messageList.get.all.db().length).toBe(messageCountBefore);
  });

  it.each([
    [
      'a rate limit error',
      new APICallError({
        message: 'Rate limit exceeded',
        url: 'https://api.openai.com/v1/responses',
        requestBodyValues: {},
        statusCode: 429,
        responseBody: JSON.stringify({ error: { message: 'Rate limit exceeded', code: 'rate_limit_exceeded' } }),
      }),
    ],
    ['a plain error', new Error('Something else went wrong')],
    ['a non-object error', 'cyber_policy'],
    ['a non-JSON response body', { responseBody: 'not json', message: 'Bad Gateway' }],
  ])('ignores %s', async (_label, error) => {
    const handler = new CyberRefusalHandler();
    const args = makeArgs({ error });
    const messageCountBefore = args.messageList.get.all.db().length;

    expect(await handler.processAPIError(args)).toBeUndefined();
    expect(args.messageList.get.all.db().length).toBe(messageCountBefore);
  });

  it('terminates on cyclic cause chains', async () => {
    const handler = new CyberRefusalHandler();
    const error = new Error('outer') as Error & { cause?: unknown };
    error.cause = error;

    expect(await handler.processAPIError(makeArgs({ error }))).toBeUndefined();
  });

  it('has correct id and name', () => {
    const handler = new CyberRefusalHandler();
    expect(handler.id).toBe('cyber-refusal-handler');
    expect(handler.name).toBe('Cyber Refusal Handler');
  });
});

// Shape @ai-sdk/anthropic reports for `stop_reason: "refusal"` from a safety classifier.
const anthropicCyberStop = {
  anthropic: {
    stopDetails: {
      type: 'refusal',
      category: 'cyber',
      explanation: 'This request triggered restrictions on violative cyber content.',
    },
  },
};

function makeStepArgs(overrides: Partial<ProcessOutputStepArgs> = {}): ProcessOutputStepArgs {
  const { messageList, messages, abort, sendSignal } = makeArgs();
  return {
    messageList,
    messages,
    abort,
    sendSignal,
    stepNumber: 3,
    steps: [],
    state: {},
    retryCount: 0,
    systemMessages: [],
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    finishReason: 'content-filter',
    providerMetadata: anthropicCyberStop,
    ...overrides,
  };
}

function captureAbort() {
  const calls: Array<{ reason?: string; options?: unknown }> = [];
  const abort = ((reason?: string, options?: unknown) => {
    calls.push({ reason, options });
    throw new TripWire(reason ?? '', options as any);
  }) as ProcessOutputStepArgs['abort'];
  return { abort, calls };
}

describe('CyberRefusalHandler.processOutputStep', () => {
  it.each([
    ['anthropic', anthropicCyberStop],
    ['another provider namespace', { vertex: anthropicCyberStop.anthropic }],
    ['an uppercase category', { anthropic: { stopDetails: { type: 'refusal', category: 'CYBER' } } }],
  ])('retries a cyber classifier stop reported under %s', async (_label, providerMetadata) => {
    const handler = new CyberRefusalHandler();
    const { abort, calls } = captureAbort();
    const args = makeStepArgs({ abort, providerMetadata });
    const messageCountBefore = args.messageList.get.all.db().length;

    expect(() => handler.processOutputStep(args)).toThrow(TripWire);

    // The abort reason is the continue nudge; no signal is added to the message list.
    expect(calls).toEqual([{ reason: 'continue', options: { retry: true } }]);
    expect(args.messageList.get.all.db().length).toBe(messageCountBefore);
  });

  it.each([
    ['a second refusal on the same step', { retryCount: 1 }],
    ['a normal finish', { finishReason: 'stop' }],
    [
      'a content filter outside the cyber category',
      { providerMetadata: { anthropic: { stopDetails: { type: 'refusal', category: 'bio' } } } },
    ],
    ['a content filter without stop details', { providerMetadata: undefined }],
    ['a cyber category without a content-filter finish', { finishReason: 'tool-calls' }],
  ])('passes through %s', async (_label, overrides) => {
    const handler = new CyberRefusalHandler();
    const { abort, calls } = captureAbort();
    const args = makeStepArgs({ abort, ...overrides });
    const messageCountBefore = args.messageList.get.all.db().length;

    expect(handler.processOutputStep(args)).toBe(args.messageList);
    expect(calls).toEqual([]);
    expect(args.messageList.get.all.db().length).toBe(messageCountBefore);
  });
});
