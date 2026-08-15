import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent/message-list';
import { RequestContext } from '../../request-context';
import { LanguageDetector } from './language-detector';
import { PIIDetector } from './pii-detector';
import { PromptInjectionDetector } from './prompt-injection-detector';
import { SystemPromptScrubber } from './system-prompt-scrubber';

function createModel(result: unknown) {
  return new MockLanguageModelV1({
    defaultObjectGenerationMode: 'json',
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { promptTokens: 1, completionTokens: 1 },
      text: JSON.stringify(result),
    }),
  });
}

function createMessage(role: 'user' | 'assistant', text: string): MastraDBMessage {
  return {
    id: `${role}-message`,
    role,
    content: { format: 2, parts: [{ type: 'text', text }] },
    createdAt: new Date(),
  };
}

function createDynamicModel(result: unknown) {
  const model = createModel(result);
  const resolver = vi.fn(() => model);
  return { model: resolver as any, resolver };
}

function expectRequestContext(resolver: ReturnType<typeof vi.fn>, requestContext: RequestContext) {
  expect(resolver).toHaveBeenCalled();
  expect(resolver.mock.calls.every(([args]) => args.requestContext === requestContext)).toBe(true);
}

describe('model-backed detector RequestContext propagation', () => {
  it('propagates RequestContext through LanguageDetector internal inference', async () => {
    const { model, resolver } = createDynamicModel({ iso_code: null, confidence: null });
    const detector = new LanguageDetector({ model, targetLanguages: ['English'] });
    const requestContext = new RequestContext();

    await detector.processInput({
      messages: [createMessage('user', 'Hello from this request context')],
      abort: vi.fn() as any,
      requestContext,
    });

    expectRequestContext(resolver, requestContext);
  });

  it('propagates RequestContext through PromptInjectionDetector internal inference', async () => {
    const { model, resolver } = createDynamicModel({ categories: null, reason: null });
    const detector = new PromptInjectionDetector({ model });
    const requestContext = new RequestContext();

    await detector.processInput({
      messages: [createMessage('user', 'A normal request for help')],
      abort: vi.fn() as any,
      requestContext,
    });

    expectRequestContext(resolver, requestContext);
  });

  it('propagates RequestContext through PIIDetector internal inference', async () => {
    const { model, resolver } = createDynamicModel({ categories: null, detections: null, redacted_content: null });
    const detector = new PIIDetector({ model });
    const requestContext = new RequestContext();

    await detector.processInput({
      messages: [createMessage('user', 'A normal request without personal details')],
      abort: vi.fn() as any,
      requestContext,
    });

    expectRequestContext(resolver, requestContext);

    resolver.mockClear();
    await detector.processOutputResult({
      messages: [createMessage('assistant', 'A normal response without personal details')],
      abort: vi.fn() as any,
      requestContext,
    });
    expectRequestContext(resolver, requestContext);

    resolver.mockClear();
    await detector.processOutputStream({
      part: {
        type: 'text-delta',
        runId: 'test-run',
        from: 'AGENT',
        payload: { id: 'text-1', text: 'A normal complete sentence.' },
      } as any,
      streamParts: [],
      state: {},
      abort: vi.fn() as any,
      requestContext,
    });
    expectRequestContext(resolver, requestContext);
  });

  it('propagates RequestContext through SystemPromptScrubber internal inference', async () => {
    const { model, resolver } = createDynamicModel({ detections: null, reason: null, redacted_content: null });
    const detector = new SystemPromptScrubber({ model });
    const requestContext = new RequestContext();

    await detector.processOutputResult({
      messages: [createMessage('assistant', 'A normal assistant response')],
      abort: vi.fn() as any,
      requestContext,
    });

    expectRequestContext(resolver, requestContext);

    resolver.mockClear();
    await detector.processOutputStream({
      part: {
        type: 'text-delta',
        runId: 'test-run',
        from: 'AGENT',
        payload: { id: 'text-1', text: 'A normal assistant stream part' },
      } as any,
      streamParts: [],
      state: {},
      abort: vi.fn() as any,
      requestContext,
    });
    expectRequestContext(resolver, requestContext);
  });
});
