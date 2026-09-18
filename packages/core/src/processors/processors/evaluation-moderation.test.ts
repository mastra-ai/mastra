import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraDBMessage } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { EvaluationVerdict } from './evaluation-moderation';
import {
  EvaluationModerationProcessor,
  createJevEvaluator,
  isModerationBlock,
  JEV_ENDPOINT,
  JEV_MODEL,
} from './evaluation-moderation';

function createTestMessage(text: string, role: 'user' | 'assistant' = 'user', id = 'test-id'): MastraDBMessage {
  return {
    id,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
    createdAt: new Date(),
  };
}

function createTestMessageWithContent(
  text: string,
  content: string,
  role: 'user' | 'assistant' = 'user',
  id = 'test-id',
): MastraDBMessage {
  return {
    id,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      content,
    },
    createdAt: new Date(),
  };
}

function createAbort() {
  return vi.fn().mockImplementation((reason?: string) => {
    throw new TripWire(reason);
  });
}

function createJevResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

const PASS_VERDICT: EvaluationVerdict = { score: 0.1, category: 'none', model: 'jev-test', tokensIn: 100 };
const BLOCK_VERDICT: EvaluationVerdict = { score: 0.95, category: 'violence', model: 'jev-test', tokensIn: 100 };

describe('EvaluationModerationProcessor', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('constructor and configuration', () => {
    it('should initialize with an evaluate function', () => {
      const moderator = new EvaluationModerationProcessor({
        evaluate: async () => PASS_VERDICT,
      });

      expect(moderator.id).toBe('evaluation-moderation');
      expect(moderator.name).toBe('Evaluation Moderation');
    });

    it('should accept custom threshold, reason, and resilience options', () => {
      const moderator = new EvaluationModerationProcessor({
        evaluate: async () => PASS_VERDICT,
        threshold: 0.9,
        reason: 'CUSTOM_BLOCK',
        maxChars: 100,
        timeoutMs: 1000,
        breaker: { threshold: 5, cooldownMs: 30_000 },
      });

      expect(moderator.id).toBe('evaluation-moderation');
    });
  });

  describe('message processing', () => {
    it('should return all messages when the score is below the threshold', async () => {
      const moderator = new EvaluationModerationProcessor({
        evaluate: async () => PASS_VERDICT,
      });
      const abort = createAbort();
      const messages = [createTestMessage('Hello, how are you?')];

      const result = await moderator.processInput({ messages, abort: abort as any });

      expect(result).toEqual(messages);
      expect(abort).not.toHaveBeenCalled();
    });

    it('should abort with the fixed reason when the score reaches the threshold', async () => {
      const moderator = new EvaluationModerationProcessor({
        evaluate: async () => BLOCK_VERDICT,
      });
      const abort = createAbort();
      const messages = [createTestMessage('Harmful content')];

      await expect(moderator.processInput({ messages, abort: abort as any })).rejects.toThrow(TripWire);

      expect(abort).toHaveBeenCalledWith('MESSAGE_BLOCKED');
    });

    it('should use the custom reason when provided', async () => {
      const moderator = new EvaluationModerationProcessor({
        evaluate: async () => BLOCK_VERDICT,
        reason: 'CUSTOM_BLOCK',
      });
      const abort = createAbort();

      await expect(
        moderator.processInput({ messages: [createTestMessage('Harmful content')], abort: abort as any }),
      ).rejects.toThrow(TripWire);

      expect(abort).toHaveBeenCalledWith('CUSTOM_BLOCK');
    });

    it('should only evaluate the last message', async () => {
      const received: string[] = [];
      const moderator = new EvaluationModerationProcessor({
        evaluate: async text => {
          received.push(text);
          return PASS_VERDICT;
        },
      });
      const messages = [
        createTestMessage('first message', 'user', 'msg1'),
        createTestMessage('second message', 'user', 'msg2'),
      ];

      const result = await moderator.processInput({ messages, abort: createAbort() as any });

      expect(result).toEqual(messages);
      expect(received).toEqual(['second message']);
    });

    it('should join text parts with a space', async () => {
      const received: string[] = [];
      const moderator = new EvaluationModerationProcessor({
        evaluate: async text => {
          received.push(text);
          return PASS_VERDICT;
        },
      });
      const message: MastraDBMessage = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'First part' }, { type: 'step-start' }, { type: 'text', text: 'second part' }],
        },
        createdAt: new Date(),
      };

      await moderator.processInput({ messages: [message], abort: createAbort() as any });

      expect(received).toEqual(['First part second part']);
    });

    it('should fall back to the legacy content field when there are no text parts', async () => {
      const received: string[] = [];
      const moderator = new EvaluationModerationProcessor({
        evaluate: async text => {
          received.push(text);
          return PASS_VERDICT;
        },
      });
      const message = createTestMessageWithContent('', 'legacy content text');

      await moderator.processInput({ messages: [message], abort: createAbort() as any });

      expect(received).toEqual(['legacy content text']);
    });

    it('should truncate the message to maxChars', async () => {
      const received: string[] = [];
      const moderator = new EvaluationModerationProcessor({
        evaluate: async text => {
          received.push(text);
          return PASS_VERDICT;
        },
        maxChars: 10,
      });

      await moderator.processInput({
        messages: [createTestMessage('a much longer message than maxChars allows')],
        abort: createAbort() as any,
      });

      expect(received).toEqual(['a much lon']);
    });

    it('should pass messages through without evaluating when there is no text', async () => {
      const evaluate = vi.fn().mockResolvedValue(PASS_VERDICT);
      const moderator = new EvaluationModerationProcessor({ evaluate });
      const message: MastraDBMessage = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'step-start' }],
        },
        createdAt: new Date(),
      };

      const result = await moderator.processInput({ messages: [message], abort: createAbort() as any });

      expect(result).toEqual([message]);
      expect(evaluate).not.toHaveBeenCalled();
    });

    it('should handle an empty message array', async () => {
      const evaluate = vi.fn().mockResolvedValue(PASS_VERDICT);
      const moderator = new EvaluationModerationProcessor({ evaluate });

      const result = await moderator.processInput({ messages: [], abort: createAbort() as any });

      expect(result).toEqual([]);
      expect(evaluate).not.toHaveBeenCalled();
    });
  });

  describe('onVerdict', () => {
    it('should call onVerdict after every answered call', async () => {
      const onVerdict = vi.fn();
      const moderator = new EvaluationModerationProcessor({
        evaluate: async () => BLOCK_VERDICT,
        onVerdict,
      });

      await expect(
        moderator.processInput({ messages: [createTestMessage('x')], abort: createAbort() as any }),
      ).rejects.toThrow(TripWire);

      expect(onVerdict).toHaveBeenCalledWith(BLOCK_VERDICT);
    });

    it('should not call onVerdict when evaluation fails', async () => {
      const onVerdict = vi.fn();
      const moderator = new EvaluationModerationProcessor({
        evaluate: async () => {
          throw new Error('HTTP 500');
        },
        onVerdict,
      });

      const result = await moderator.processInput({
        messages: [createTestMessage('x')],
        abort: createAbort() as any,
      });

      expect(result).toHaveLength(1);
      expect(onVerdict).not.toHaveBeenCalled();
    });
  });

  describe('failure handling', () => {
    it('should fail open when the evaluation throws', async () => {
      const moderator = new EvaluationModerationProcessor({
        evaluate: async () => {
          throw new Error('HTTP 500');
        },
      });
      const abort = createAbort();
      const messages = [createTestMessage('Test content')];

      const result = await moderator.processInput({ messages, abort: abort as any });

      expect(result).toEqual(messages);
      expect(abort).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EvaluationModerationProcessor] Evaluation returned no verdict'),
        expect.anything(),
      );
    });

    it('should fail open when the evaluation times out', async () => {
      const moderator = new EvaluationModerationProcessor({
        evaluate: (_text, signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('timed out')));
          }),
        timeoutMs: 10,
      });
      const messages = [createTestMessage('Test content')];

      const result = await moderator.processInput({ messages, abort: createAbort() as any });

      expect(result).toEqual(messages);
    });

    it('should abort when errorStrategy is strict and evaluation fails', async () => {
      const moderator = new EvaluationModerationProcessor({
        evaluate: async () => {
          throw new Error('HTTP 500');
        },
        errorStrategy: 'strict',
      });
      const abort = createAbort();

      await expect(
        moderator.processInput({ messages: [createTestMessage('Test content')], abort: abort as any }),
      ).rejects.toThrow(TripWire);

      expect(abort).toHaveBeenCalledWith('Moderation failed because the evaluation call failed');
    });
  });

  describe('circuit breaker', () => {
    it('should open after the configured number of consecutive failures and fail open fast', async () => {
      const evaluate = vi.fn().mockRejectedValue(new Error('HTTP 500'));
      const moderator = new EvaluationModerationProcessor({
        evaluate,
        breaker: { threshold: 3, cooldownMs: 60_000 },
      });
      const messages = [createTestMessage('Test content')];

      for (let i = 0; i < 3; i++) {
        await moderator.processInput({ messages, abort: createAbort() as any });
      }
      expect(evaluate).toHaveBeenCalledTimes(3);

      // Breaker is open: the next call fails open without calling evaluate
      const result = await moderator.processInput({ messages, abort: createAbort() as any });
      expect(result).toEqual(messages);
      expect(evaluate).toHaveBeenCalledTimes(3);
    });

    it('should resume evaluating after the cooldown expires', async () => {
      let now = 0;
      const evaluate = vi
        .fn()
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockResolvedValue(PASS_VERDICT);
      const moderator = new EvaluationModerationProcessor({
        evaluate,
        breaker: { threshold: 2, cooldownMs: 60_000 },
        now: () => now,
      });
      const messages = [createTestMessage('Test content')];

      await moderator.processInput({ messages, abort: createAbort() as any });
      await moderator.processInput({ messages, abort: createAbort() as any });
      expect(evaluate).toHaveBeenCalledTimes(2);

      // Still inside the cooldown: no call
      await moderator.processInput({ messages, abort: createAbort() as any });
      expect(evaluate).toHaveBeenCalledTimes(2);

      // Cooldown expired: calls resume and the breaker resets
      now = 61_000;
      const result = await moderator.processInput({ messages, abort: createAbort() as any });
      expect(result).toEqual(messages);
      expect(evaluate).toHaveBeenCalledTimes(3);
    });

    it('should reset the failure count after a success', async () => {
      const evaluate = vi
        .fn()
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockResolvedValueOnce(PASS_VERDICT)
        .mockRejectedValue(new Error('HTTP 500'));
      const moderator = new EvaluationModerationProcessor({
        evaluate,
        breaker: { threshold: 3, cooldownMs: 60_000 },
      });
      const messages = [createTestMessage('Test content')];

      // fail, fail, success -> counter resets; two more failures must not open it
      for (let i = 0; i < 5; i++) {
        await moderator.processInput({ messages, abort: createAbort() as any });
      }

      expect(evaluate).toHaveBeenCalledTimes(5);
    });
  });

  describe('isModerationBlock', () => {
    it('should identify a moderation block tripwire', () => {
      expect(isModerationBlock({ reason: 'MESSAGE_BLOCKED' })).toBe(true);
      expect(isModerationBlock({ reason: 'OTHER_REASON' })).toBe(false);
      expect(isModerationBlock(undefined)).toBe(false);
    });

    it('should respect a custom reason', () => {
      expect(isModerationBlock({ reason: 'CUSTOM' }, 'CUSTOM')).toBe(true);
    });
  });
});

describe('createJevEvaluator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send one request with the blocking and category questions', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createJevResponse({
        answers: { blocking: { noul: 0.1 }, category: { choice: 'none' } },
        model: 'jev-1.13.0',
        usage: { input_tokens: 42 },
      }),
    );
    const evaluate = createJevEvaluator({ apiKey: 'test-key', fetchFn });

    const verdict = await evaluate('hello there', AbortSignal.timeout(1000));

    expect(verdict).toEqual({ score: 0.1, category: 'none', model: 'jev-1.13.0', tokensIn: 42 });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(JEV_ENDPOINT);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(JEV_MODEL);
    expect(body.state).toEqual({ message: 'hello there' });
    expect(body.questions.blocking.type).toBe('noul');
    expect(body.questions.category.type).toBe('choice');
    expect(body.questions.category.criteria.none).toBeDefined();
  });

  it('should use a custom endpoint, model, context, policy, and categories', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createJevResponse({
        answers: { blocking: { noul: 0.1 }, category: { choice: 'custom-cat' } },
      }),
    );
    const evaluate = createJevEvaluator({
      apiKey: 'test-key',
      endpoint: 'https://example.com/jev',
      model: 'jev-custom',
      context: 'A coding assistant.',
      policy: { allow: 'benign', block: 'harmful' },
      categories: { 'custom-cat': 'A custom category.' },
      fetchFn,
    });

    const verdict = await evaluate('text', AbortSignal.timeout(1000));

    expect(verdict.score).toBe(0.1);
    expect(verdict.category).toBe('custom-cat');
    expect(verdict.model).toBe('jev-custom');

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/jev');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('jev-custom');
    expect(body.questions.blocking.criteria).toEqual({ false: 'benign', true: 'harmful' });
    expect(body.questions.blocking.instructions).toContain('A coding assistant.');
    expect(body.questions.category.criteria['custom-cat']).toBe('A custom category.');
  });

  it('should keep a block verdict when the category answer is missing', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createJevResponse({
        answers: { blocking: { noul: 0.95 } },
      }),
    );
    const evaluate = createJevEvaluator({ apiKey: 'test-key', fetchFn });

    const verdict = await evaluate('harmful', AbortSignal.timeout(1000));

    expect(verdict.score).toBe(0.95);
    expect(verdict.category).toBe('none');
  });

  it('should throw on HTTP errors without including the response body', async () => {
    const fetchFn = vi.fn().mockResolvedValue(createJevResponse({}, false, 429));
    const evaluate = createJevEvaluator({ apiKey: 'test-key', fetchFn });

    await expect(evaluate('text', AbortSignal.timeout(1000))).rejects.toThrow('jev: HTTP 429');
  });

  it('should throw on an unparsable answer', async () => {
    const fetchFn = vi.fn().mockResolvedValue(createJevResponse({ unexpected: 'shape' }));
    const evaluate = createJevEvaluator({ apiKey: 'test-key', fetchFn });

    await expect(evaluate('text', AbortSignal.timeout(1000))).rejects.toThrow('jev: no parsable verdict');
  });

  it('should propagate the abort signal to fetch', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createJevResponse({
        answers: { blocking: { noul: 0.1 }, category: { choice: 'none' } },
      }),
    );
    const evaluate = createJevEvaluator({ apiKey: 'test-key', fetchFn });
    const signal = AbortSignal.timeout(1000);

    await evaluate('text', signal);

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(signal);
  });
});
