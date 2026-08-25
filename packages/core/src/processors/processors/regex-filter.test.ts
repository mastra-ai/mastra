import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraDBMessage, MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { ChunkType } from '../../stream';
import type { ProcessInputArgs, ProcessOutputResultArgs, ProcessOutputStreamArgs } from '../index';
import { REPROCESS_PART_KEY } from '../stream-reprocess';
import { RegexFilterProcessor } from './regex-filter';

function createMessage(text: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage {
  return {
    id: `msg-${Math.random()}`,
    role,
    content: { format: 2, parts: [{ type: 'text' as const, text }] },
    createdAt: new Date(),
  };
}

function createInputArgs(messages: MastraDBMessage[]): ProcessInputArgs {
  return {
    messages,
    messageList: {} as MessageList,
    abort: ((reason?: string) => {
      throw new TripWire(reason ?? 'aborted', { retry: false });
    }) as any,
    retryCount: 0,
    model: { modelId: 'test', provider: 'test', specificationVersion: 'v2' } as any,
    systemMessages: [],
    state: {},
  };
}

function createOutputResultArgs(messages: MastraDBMessage[]): ProcessOutputResultArgs {
  return {
    messages,
    messageList: {} as MessageList,
    abort: ((reason?: string) => {
      throw new TripWire(reason ?? 'aborted', { retry: false });
    }) as any,
    retryCount: 0,
    model: { modelId: 'test', provider: 'test', specificationVersion: 'v2' } as any,
    state: {},
  };
}

function createStreamArgs(part: ChunkType, state: Record<string, unknown> = {}): ProcessOutputStreamArgs {
  return {
    part,
    streamParts: [],
    abort: ((reason?: string) => {
      throw new TripWire(reason ?? 'aborted', { retry: false });
    }) as any,
    retryCount: 0,
    model: { modelId: 'test', provider: 'test', specificationVersion: 'v2' } as any,
    state,
  };
}

function textDelta(text: string): ChunkType {
  return {
    type: 'text-delta',
    runId: 'r',
    from: 'AGENT',
    payload: { id: 't1', text },
  } as unknown as ChunkType;
}

function textEnd(): ChunkType {
  return { type: 'text-end', runId: 'r', from: 'AGENT', payload: { id: 't1' } } as unknown as ChunkType;
}

function finishPart(): ChunkType {
  return { type: 'finish', runId: 'r', from: 'AGENT', payload: {} } as unknown as ChunkType;
}

function textChunks(text: string, size: number): ChunkType[] {
  const parts: ChunkType[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(textDelta(text.slice(i, i + size)));
  return parts;
}

/**
 * Drives a sequence of stream parts through the processor with a shared state,
 * the way the ProcessorRunner does, and returns every part it emitted.
 *
 * The helper invokes the processor directly without a writer, so a flush can
 * defer the non-text part that triggered it to the next call. Once the stream
 * has ended there is no next call, so the helper drains the deferred part from
 * the state — what a direct caller must do, and what the runner does via
 * REPROCESS_PART_KEY when a writer is present.
 */
async function runStream(filter: RegexFilterProcessor, parts: ChunkType[]): Promise<ChunkType[]> {
  const state: Record<string, unknown> = {};
  const emitted: ChunkType[] = [];
  for (const part of parts) {
    const result = await filter.processOutputStream(createStreamArgs(part, state));
    if (result) emitted.push(result);
  }
  const deferred = state._regexFilterPendingNonText as ChunkType | undefined;
  if (deferred) emitted.push(deferred);
  return emitted;
}

function streamedText(emitted: ChunkType[]): string {
  return emitted
    .filter(part => part.type === 'text-delta')
    .map(part => (part as any).payload.text)
    .join('');
}

describe('RegexFilterProcessor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws if no rules or presets are provided', () => {
      expect(() => new RegexFilterProcessor({})).toThrow('RegexFilterProcessor requires at least one rule or preset');
    });

    it('accepts custom rules', () => {
      const filter = new RegexFilterProcessor({
        rules: [{ name: 'test', pattern: /test/g }],
      });
      expect(filter.id).toBe('regex-filter');
    });

    it('accepts presets', () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'] });
      expect(filter.name).toBe('Regex Filter');
    });

    it('combines presets and custom rules', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        rules: [{ name: 'custom', pattern: /custom/g }],
      });
      expect(filter.id).toBe('regex-filter');
    });

    it('throws for a non-positive or non-integer streamCarryoverSize', () => {
      for (const bad of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        expect(() => new RegexFilterProcessor({ presets: ['pii'], streamCarryoverSize: bad })).toThrow(
          'streamCarryoverSize must be a positive safe integer',
        );
      }
    });

    it('accepts a custom streamCarryoverSize', () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'], streamCarryoverSize: 256 });
      expect(filter.id).toBe('regex-filter');
    });
  });

  describe('processInput - block strategy', () => {
    it('blocks when email detected', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const args = createInputArgs([createMessage('Contact me at user@example.com')]);
      expect(() => filter.processInput(args)).toThrow(TripWire);
    });

    it('blocks when phone number detected', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const args = createInputArgs([createMessage('Call me at (555) 123-4567')]);
      expect(() => filter.processInput(args)).toThrow(TripWire);
    });

    it('blocks when SSN detected', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const args = createInputArgs([createMessage('SSN is 123-45-6789')]);
      expect(() => filter.processInput(args)).toThrow(TripWire);
    });

    it('blocks when credit card detected', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const args = createInputArgs([createMessage('Card: 4111 1111 1111 1111')]);
      expect(() => filter.processInput(args)).toThrow(TripWire);
    });

    it('allows clean content', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const messages = [createMessage('Hello, how are you?')];
      const args = createInputArgs(messages);
      const result = filter.processInput(args);
      expect(result).toBe(messages);
    });

    it('includes match metadata in TripWire', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const args = createInputArgs([createMessage('Email: test@example.com')]);
      try {
        filter.processInput(args);
        expect.fail('Expected TripWire');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        const tripwire = error as TripWire<any>;
        expect(tripwire.options.metadata).toMatchObject({
          processorId: 'regex-filter',
          strategy: 'block',
        });
        expect(tripwire.options.metadata.matches.length).toBeGreaterThan(0);
        expect(tripwire.options.metadata.matches[0].rule).toBe('email');
        expect(tripwire.options.metadata.matches[0].match).toBe('[REDACTED_MATCH]');
      }
    });
  });

  describe('processInput - redact strategy', () => {
    it('redacts email addresses', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'redact',
      });

      const args = createInputArgs([createMessage('Contact user@example.com please')]);
      const result = filter.processInput(args) as MastraDBMessage[];

      expect(result).toBeDefined();
      const content = result[0].content as any;
      expect(content.parts[0].text).toBe('Contact [EMAIL] please');
    });

    it('redacts multiple patterns', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'redact',
      });

      const args = createInputArgs([createMessage('Email: a@b.com, SSN: 123-45-6789')]);
      const result = filter.processInput(args) as MastraDBMessage[];

      expect(result).toBeDefined();
      const content = result[0].content as any;
      expect(content.parts[0].text).toContain('[EMAIL]');
      expect(content.parts[0].text).toContain('[SSN]');
    });

    it('uses custom replacement text', () => {
      const filter = new RegexFilterProcessor({
        rules: [{ name: 'id', pattern: /ID-\d+/g, replacement: '***' }],
        strategy: 'redact',
      });

      const args = createInputArgs([createMessage('Your order ID-12345')]);
      const result = filter.processInput(args) as MastraDBMessage[];

      expect(result).toBeDefined();
      const content = result[0].content as any;
      expect(content.parts[0].text).toBe('Your order ***');
    });
  });

  describe('overlapping matches - redact strategy', () => {
    function redactedText(text: string): string {
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });
      const result = filter.processInput(createInputArgs([createMessage(text)])) as MastraDBMessage[];
      return (result[0].content as any).parts[0].text;
    }

    it('does not leave part of a bare card number in the clear', () => {
      const text = redactedText('card 4111111111111111');

      expect(text).toBe('card [CREDIT_CARD]');
      expect(text).not.toContain('1111');
    });

    it('redacts a bare card number surrounded by text', () => {
      expect(redactedText('pay 4111111111111111 now')).toBe('pay [CREDIT_CARD] now');
    });

    it('still redacts a separated card number', () => {
      expect(redactedText('card 4111-1111-1111-1111')).toBe('card [CREDIT_CARD]');
      expect(redactedText('card 4111 1111 1111 1111')).toBe('card [CREDIT_CARD]');
    });

    it('redacts non-overlapping matches independently', () => {
      expect(redactedText('ssn 123-45-6789 card 4111111111111111')).toBe('ssn [SSN] card [CREDIT_CARD]');
    });

    it('redacts a contained match as a single region', () => {
      const filter = new RegexFilterProcessor({ presets: ['pii', 'urls'], strategy: 'redact' });
      const result = filter.processInput(
        createInputArgs([createMessage('see https://x.com/u/a@b.com now')]),
      ) as MastraDBMessage[];

      expect((result[0].content as any).parts[0].text).toBe('see [URL] now');
    });

    it('redacts overlapping matches in streaming chunks', async () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });
      const emitted = await runStream(filter, [textDelta('card 4111111111111111'), textEnd()]);

      expect(streamedText(emitted)).toBe('card [CREDIT_CARD]');
    });

    it('keeps capture groups in custom replacements', () => {
      const filter = new RegexFilterProcessor({
        rules: [{ name: 'order', pattern: /ID-(\d+)/g, replacement: '<$1>' }],
        strategy: 'redact',
      });

      const result = filter.processInput(createInputArgs([createMessage('Your order ID-12345')])) as MastraDBMessage[];

      expect((result[0].content as any).parts[0].text).toBe('Your order <12345>');
    });

    it('merges a partial overlap and keeps the longest rule', () => {
      const filter = new RegexFilterProcessor({
        rules: [
          { name: 'short', pattern: /ab/g, replacement: '[SHORT]' },
          { name: 'long', pattern: /bcdef/g, replacement: '[LONG]' },
        ],
        strategy: 'redact',
      });

      const result = filter.processInput(createInputArgs([createMessage('xabcdefy')])) as MastraDBMessage[];

      expect((result[0].content as any).parts[0].text).toBe('x[LONG]y');
    });

    it('does not merge matches that only touch', () => {
      const filter = new RegexFilterProcessor({
        rules: [
          { name: 'first', pattern: /ab/g, replacement: '[A]' },
          { name: 'second', pattern: /cd/g, replacement: '[B]' },
        ],
        strategy: 'redact',
      });

      const result = filter.processInput(createInputArgs([createMessage('abcd')])) as MastraDBMessage[];

      expect((result[0].content as any).parts[0].text).toBe('[A][B]');
    });

    it('redacts several overlap groups in one message', () => {
      expect(redactedText('card 4111111111111111 and card 4222222222222222')).toBe(
        'card [CREDIT_CARD] and card [CREDIT_CARD]',
      );
    });

    it('keeps offsets correct after multi-byte characters', () => {
      expect(redactedText('💳 4111111111111111 ✅')).toBe('💳 [CREDIT_CARD] ✅');
    });

    it('reports every overlapping match when blocking', () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'block' });

      try {
        filter.processInput(createInputArgs([createMessage('card 4111111111111111')]));
        expect.fail('Expected TripWire');
      } catch (error) {
        const rules = (error as TripWire<any>).options.metadata.matches.map((m: any) => m.rule);
        expect(rules).toContain('phone');
        expect(rules).toContain('credit-card');
      }
    });

    it('redacts overlapping matches in output results', () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });
      const result = filter.processOutputResult(
        createOutputResultArgs([createMessage('card 4111111111111111', 'assistant')]),
      ) as MastraDBMessage[];

      expect((result[0].content as any).parts[0].text).toBe('card [CREDIT_CARD]');
    });

    it('redacts overlapping matches in string-form content', () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });
      const message = { ...createMessage('placeholder'), content: 'card 4111111111111111' } as any;
      const result = filter.processInput(createInputArgs([message])) as MastraDBMessage[];

      expect(result[0].content).toBe('card [CREDIT_CARD]');
    });

    it('redacts each text part independently', () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });
      const message: MastraDBMessage = {
        id: 'msg-parts',
        role: 'user',
        content: {
          format: 2,
          parts: [
            { type: 'text' as const, text: 'card 4111111111111111' },
            { type: 'text' as const, text: 'clean text' },
            { type: 'text' as const, text: 'ssn 123-45-6789' },
          ],
        },
        createdAt: new Date(),
      } as MastraDBMessage;

      const result = filter.processInput(createInputArgs([message])) as MastraDBMessage[];
      const parts = (result[0].content as any).parts;

      expect(parts[0].text).toBe('card [CREDIT_CARD]');
      expect(parts[1].text).toBe('clean text');
      expect(parts[2].text).toBe('ssn [SSN]');
    });
  });

  describe('replacement resolution', () => {
    function redactWith(rules: any[], text: string): string {
      const filter = new RegexFilterProcessor({ rules, strategy: 'redact' });
      const result = filter.processInput(createInputArgs([createMessage(text)])) as MastraDBMessage[];
      return (result[0].content as any).parts[0].text;
    }

    it('expands the whole-match reference', () => {
      expect(redactWith([{ name: 'order', pattern: /ID-\d+/g, replacement: '<$&>' }], 'order ID-12345')).toBe(
        'order <ID-12345>',
      );
    });

    it('redacts a rule anchored on its surroundings', () => {
      expect(redactWith([{ name: 'ctx', pattern: /(?<=card )\d{4}/g, replacement: '[X]' }], 'card 1234')).toBe(
        'card [X]',
      );
    });

    it('falls back to the literal replacement when a match cannot be re-resolved', () => {
      expect(redactWith([{ name: 'ctx', pattern: /(?<=card )\d{4}/g, replacement: '<$&>' }], 'card 1234')).toBe(
        'card <$&>',
      );
    });

    it('falls back when the pattern covers less of the region on its own', () => {
      const text = redactWith([{ name: 'lead', pattern: /\d+(?=\d)/g, replacement: '<$&>' }], '1234');

      expect(text).toBe('<$&>4');
      expect(text).not.toContain('12');
    });

    it('leaves text untouched for a rule that only matches empty strings', () => {
      expect(redactWith([{ name: 'empty', pattern: /x*/g, replacement: '[Z]' }], 'abc')).toBe('abc');
    });

    it('redacts only the first match for a non-global pattern', () => {
      expect(redactWith([{ name: 'num', pattern: /\d+/, replacement: '[N]' }], 'a1 b2')).toBe('a[N] b2');
    });

    it('uses the default replacement when a rule omits one', () => {
      expect(redactWith([{ name: 'num', pattern: /\d+/g }], 'a1 b2')).toBe('a[REDACTED] b[REDACTED]');
    });
  });

  describe('onViolation reporting', () => {
    function createFilter(options: Partial<Record<string, unknown>> = {}) {
      const violations: any[] = [];
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact', ...options } as any);
      filter.onViolation = violation => {
        violations.push(violation);
      };
      return { filter, violations };
    }

    it('reports the rule, offset, length, and replacement', async () => {
      const { filter, violations } = createFilter();

      await filter.processInput(createInputArgs([createMessage('Contact user@example.com please')]));

      expect(violations).toHaveLength(1);
      expect(violations[0].processorId).toBe('regex-filter');
      expect(violations[0].message).toContain('email');
      expect(violations[0].detail).toMatchObject({ strategy: 'redact', phase: 'processInput' });
      expect(violations[0].detail.redactions).toEqual([
        { rule: 'email', index: 8, length: 16, replacement: '[EMAIL]' },
      ]);
    });

    it('reports offsets into the original text, in document order', async () => {
      const { filter, violations } = createFilter();

      const text = 'ssn 123-45-6789 mail a@b.com';
      await filter.processInput(createInputArgs([createMessage(text)]));

      const [first, second] = violations[0].detail.redactions;
      expect(first.rule).toBe('ssn');
      expect(text.slice(first.index, first.index + first.length)).toBe('123-45-6789');
      expect(second.rule).toBe('email');
      expect(text.slice(second.index, second.index + second.length)).toBe('a@b.com');
    });

    it('lists the overlapping rules for a merged region', async () => {
      const { filter, violations } = createFilter();

      await filter.processInput(createInputArgs([createMessage('card 4111111111111111')]));

      const [redaction] = violations[0].detail.redactions;
      expect(redaction.rule).toBe('credit-card');
      expect(redaction.overlappingRules).toEqual(expect.arrayContaining(['phone', 'credit-card']));
    });

    it('omits overlappingRules when only one rule matched', async () => {
      const { filter, violations } = createFilter();

      await filter.processInput(createInputArgs([createMessage('mail a@b.com')]));

      expect(violations[0].detail.redactions[0]).not.toHaveProperty('overlappingRules');
    });

    it('omits the redacted value by default', async () => {
      const { filter, violations } = createFilter();

      await filter.processInput(createInputArgs([createMessage('mail a@b.com')]));

      expect(violations[0].detail.redactions[0]).not.toHaveProperty('value');
    });

    it('includes the redacted value when opted in', async () => {
      const { filter, violations } = createFilter({ includeRedactedValues: true });

      await filter.processInput(createInputArgs([createMessage('mail a@b.com')]));

      expect(violations[0].detail.redactions[0].value).toBe('a@b.com');
    });

    it('identifies the message and part a redaction came from', async () => {
      const { filter, violations } = createFilter();

      const message: MastraDBMessage = {
        id: 'msg-fixed',
        role: 'user',
        content: {
          format: 2,
          parts: [
            { type: 'text' as const, text: 'clean text' },
            { type: 'text' as const, text: 'mail a@b.com' },
          ],
        },
        createdAt: new Date(),
      } as MastraDBMessage;

      await filter.processInput(createInputArgs([message]));

      expect(violations).toHaveLength(1);
      expect(violations[0].detail.messageId).toBe('msg-fixed');
      expect(violations[0].detail.partIndex).toBe(1);
    });

    it('identifies the message but no part for string content', async () => {
      const { filter, violations } = createFilter();

      const message = { ...createMessage('placeholder'), id: 'msg-string', content: 'mail a@b.com' } as any;
      await filter.processInput(createInputArgs([message]));

      expect(violations[0].detail.messageId).toBe('msg-string');
      expect(violations[0].detail).not.toHaveProperty('partIndex');
    });

    it('reports stream chunks without a message or part', async () => {
      const { filter, violations } = createFilter();

      await runStream(filter, [textDelta('mail a@b.com'), textEnd()]);

      expect(violations[0].detail.phase).toBe('processOutputStream');
      expect(violations[0].detail).not.toHaveProperty('messageId');
      expect(violations[0].detail).not.toHaveProperty('partIndex');
    });

    it('reports output results with the matching phase', async () => {
      const { filter, violations } = createFilter();

      await filter.processOutputResult(createOutputResultArgs([createMessage('mail a@b.com', 'assistant')]));

      expect(violations[0].detail.phase).toBe('processOutputResult');
    });

    it('waits for an async callback before returning', async () => {
      const order: string[] = [];
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });
      filter.onViolation = async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        order.push('callback');
      };

      await filter.processInput(createInputArgs([createMessage('mail a@b.com')]));
      order.push('after');

      expect(order).toEqual(['callback', 'after']);
    });

    it('stays synchronous when no callback is attached', () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });

      const result = filter.processInput(createInputArgs([createMessage('mail a@b.com')]));

      expect(result).not.toBeInstanceOf(Promise);
      expect(((result as MastraDBMessage[])[0].content as any).parts[0].text).toBe('mail [EMAIL]');
    });

    it('is not called by the processor for the warn strategy', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { filter, violations } = createFilter({ strategy: 'warn' });

      filter.processInput(createInputArgs([createMessage('mail a@b.com')]));

      expect(violations).toHaveLength(0);
      spy.mockRestore();
    });

    it('is not called by the processor for the block strategy', () => {
      const { filter, violations } = createFilter({ strategy: 'block' });

      expect(() => filter.processInput(createInputArgs([createMessage('mail a@b.com')]))).toThrow(TripWire);
      expect(violations).toHaveLength(0);
    });

    it('is not called when nothing matched', async () => {
      const { filter, violations } = createFilter();

      await filter.processInput(createInputArgs([createMessage('nothing sensitive here')]));

      expect(violations).toHaveLength(0);
    });

    it('still redacts when the callback throws', async () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });
      filter.onViolation = () => {
        throw new Error('audit sink down');
      };

      const result = (await filter.processInput(createInputArgs([createMessage('mail a@b.com')]))) as MastraDBMessage[];

      expect((result[0].content as any).parts[0].text).toBe('mail [EMAIL]');
    });

    it('still redacts when an async callback rejects', async () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });
      filter.onViolation = async () => {
        throw new Error('audit sink down');
      };

      const result = (await filter.processInput(createInputArgs([createMessage('mail a@b.com')]))) as MastraDBMessage[];

      expect((result[0].content as any).parts[0].text).toBe('mail [EMAIL]');
    });
  });

  describe('processInput - warn strategy', () => {
    it('logs warning and passes through', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'warn',
      });

      const messages = [createMessage('Email: test@test.com')];
      const args = createInputArgs(messages);
      const result = filter.processInput(args);

      expect(result).toBe(messages);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('[RegexFilterProcessor]'));

      spy.mockRestore();
    });
  });

  describe('phase filtering', () => {
    it('skips input when phase is output', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
        phase: 'output',
      });

      const messages = [createMessage('Email: test@test.com')];
      const args = createInputArgs(messages);
      const result = filter.processInput(args);
      expect(result).toBe(messages);
    });

    it('skips output when phase is input', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
        phase: 'input',
      });

      const messages = [createMessage('Email: test@test.com', 'assistant')];
      const args = createOutputResultArgs(messages);
      const result = filter.processOutputResult(args);
      expect(result).toBe(messages);
    });

    it('processes both phases when phase is all', async () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
        phase: 'all',
      });

      const inputArgs = createInputArgs([createMessage('Email: test@test.com')]);
      expect(() => filter.processInput(inputArgs)).toThrow(TripWire);

      const outputArgs = createOutputResultArgs([createMessage('Email: test@test.com', 'assistant')]);
      expect(() => filter.processOutputResult(outputArgs)).toThrow(TripWire);
    });
  });

  describe('processOutputStream', () => {
    it('blocks streaming content with matches', async () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const part = {
        type: 'text-delta',
        runId: 'r',
        from: 'AGENT',
        payload: { id: 't1', text: 'Email: test@test.com' },
      } as unknown as ChunkType;
      const args = createStreamArgs(part);
      await expect(filter.processOutputStream(args)).rejects.toThrow(TripWire);
    });

    it('redacts streaming content', async () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'redact',
      });

      const emitted = await runStream(filter, [textDelta('Email: test@test.com'), textEnd()]);

      expect(streamedText(emitted)).toContain('[EMAIL]');
    });

    it('redacts a secret split across two streaming chunks', async () => {
      const filter = new RegexFilterProcessor({
        rules: [{ name: 'anthropic-key', pattern: /sk-ant-[a-zA-Z0-9-]{10,}/g, replacement: '[ANTHROPIC_KEY]' }],
        strategy: 'redact',
      });

      const emitted = await runStream(filter, [
        textDelta('Here is the key: sk-ant-'),
        textDelta('api03-abcdef1234567890 done'),
        textEnd(),
      ]);

      const streamed = streamedText(emitted);
      expect(streamed).not.toContain('sk-ant-api03-abcdef1234567890');
      expect(streamed).toBe('Here is the key: [ANTHROPIC_KEY] done');
    });

    it('redacts a secret contained in a single streaming chunk', async () => {
      const filter = new RegexFilterProcessor({
        rules: [{ name: 'anthropic-key', pattern: /sk-ant-[a-zA-Z0-9-]{10,}/g, replacement: '[ANTHROPIC_KEY]' }],
        strategy: 'redact',
      });

      const emitted = await runStream(filter, [
        textDelta('Here is the key: sk-ant-api03-abcdef1234567890 done'),
        textEnd(),
      ]);

      expect(streamedText(emitted)).toBe('Here is the key: [ANTHROPIC_KEY] done');
    });

    it('passes clean chunks through unchanged once the held-back tail flushes', async () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'redact',
      });

      const emitted = await runStream(filter, [textDelta('Hello, '), textDelta('world!'), textEnd()]);

      expect(streamedText(emitted)).toBe('Hello, world!');
    });

    it('redacts a match that crosses the emission boundary of a long stream', async () => {
      const filter = new RegexFilterProcessor({
        rules: [{ name: 'anthropic-key', pattern: /sk-ant-[a-zA-Z0-9-]{10,}/g, replacement: '[ANTHROPIC_KEY]' }],
        strategy: 'redact',
      });

      const emitted = await runStream(filter, [
        textDelta('x'.repeat(200) + 'sk-ant-'),
        textDelta('api03-abcdef1234567890' + '!'.repeat(100)),
        textDelta('!'.repeat(50)),
        textEnd(),
      ]);

      expect(streamedText(emitted)).toBe('x'.repeat(200) + '[ANTHROPIC_KEY]' + '!'.repeat(150));
    });

    it('redacts an unbounded match longer than the carryover window whole', async () => {
      const filter = new RegexFilterProcessor({
        rules: [{ name: 'bearer', pattern: /Bearer\s+[a-zA-Z0-9]+/g, replacement: '[TOKEN]' }],
        strategy: 'redact',
      });

      const text = `Authorization: Bearer ${'T'.repeat(300)} end`;
      const emitted = await runStream(filter, [...textChunks(text, 20), textEnd()]);

      expect(streamedText(emitted)).toBe('Authorization: [TOKEN] end');
    });

    it('redacts a terminator-delimited match longer than the window when the carryover is raised', async () => {
      const filter = new RegexFilterProcessor({
        rules: [{ name: 'armored-key', pattern: /-----BEGIN KEY-----[A-Z]+-----END KEY-----/g, replacement: '[KEY]' }],
        strategy: 'redact',
        streamCarryoverSize: 256,
      });

      const text = `${'x'.repeat(200)} -----BEGIN KEY-----${'A'.repeat(200)}-----END KEY----- done`;
      const emitted = await runStream(filter, [...textChunks(text, 25), textEnd()]);

      expect(streamedText(emitted)).toBe(`${'x'.repeat(200)} [KEY] done`);
    });

    it('redacts a fixed-length match longer than the default window when the carryover is raised', async () => {
      const filter = new RegexFilterProcessor({
        rules: [{ name: 'blob', pattern: /BLOB-[0-9]{200}/g, replacement: '[BLOB]' }],
        strategy: 'redact',
        streamCarryoverSize: 256,
      });

      const text = `${'x'.repeat(200)} BLOB-${'7'.repeat(200)} ok`;
      const emitted = await runStream(filter, [...textChunks(text, 25), textEnd()]);

      expect(streamedText(emitted)).toBe(`${'x'.repeat(200)} [BLOB] ok`);
    });

    it('delivers the flush-triggering text-end to direct callers once drained', async () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });

      const emitted = await runStream(filter, [textDelta('mail a@b.com'), textEnd()]);

      expect(emitted.map(part => part.type)).toEqual(['text-delta', 'text-end']);
      expect(streamedText(emitted)).toBe('mail [EMAIL]');
    });

    it('hands a flush-deferred non-text part to the next call when invoked without a writer', async () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });
      const state: Record<string, unknown> = {};
      const drive = (part: ChunkType) => filter.processOutputStream(createStreamArgs(part, state));

      expect(await drive(textDelta('mail a@b.com'))).toBeNull();
      expect((await drive(textEnd()))?.type).toBe('text-delta');

      const finish = finishPart();
      const deferred = await drive(finish);
      expect(deferred?.type).toBe('text-end');
      expect(state._regexFilterPendingNonText).toBe(finish);
    });

    it('stashes the flush-triggering part for the runner to re-drive when a writer is present', async () => {
      const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });
      const state: Record<string, unknown> = {};
      const writer = { custom: vi.fn(async () => {}) };
      const drive = (part: ChunkType) => filter.processOutputStream({ ...createStreamArgs(part, state), writer });

      await drive(textDelta('mail a@b.com'));
      const end = textEnd();
      const flushed = await drive(end);

      expect(flushed?.type).toBe('text-delta');
      expect((flushed as any).payload.text).toBe('mail [EMAIL]');
      expect(state[REPROCESS_PART_KEY]).toBe(end);
      expect(state._regexFilterPendingNonText).toBeUndefined();
    });

    it('passes through non-text chunks', async () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const part: ChunkType = { type: 'step-finish' } as ChunkType;
      const args = createStreamArgs(part);
      const result = await filter.processOutputStream(args);
      expect(result).toBe(part);
    });

    it('passes through clean text chunks', async () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const part = {
        type: 'text-delta',
        runId: 'r',
        from: 'AGENT',
        payload: { id: 't1', text: 'Hello world' },
      } as unknown as ChunkType;
      const args = createStreamArgs(part);
      const result = await filter.processOutputStream(args);
      expect(result).toBe(part);
    });

    it('skips stream when phase is input', async () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
        phase: 'input',
      });

      const part = {
        type: 'text-delta',
        runId: 'r',
        from: 'AGENT',
        payload: { id: 't1', text: 'Email: test@test.com' },
      } as unknown as ChunkType;
      const args = createStreamArgs(part);
      const result = await filter.processOutputStream(args);
      expect(result).toBe(part);
    });
  });

  describe('presets', () => {
    it('secrets preset detects API keys', () => {
      const filter = new RegexFilterProcessor({
        presets: ['secrets'],
        strategy: 'block',
      });

      const args = createInputArgs([createMessage('api_key: example_api_key_abc123def456ghi789jkl012')]);
      expect(() => filter.processInput(args)).toThrow(TripWire);
    });

    it('secrets preset detects bearer tokens', () => {
      const filter = new RegexFilterProcessor({
        presets: ['secrets'],
        strategy: 'block',
      });

      const args = createInputArgs([createMessage('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test')]);
      expect(() => filter.processInput(args)).toThrow(TripWire);
    });

    it('secrets preset detects AWS keys', () => {
      const filter = new RegexFilterProcessor({
        presets: ['secrets'],
        strategy: 'block',
      });

      const args = createInputArgs([createMessage('Key: AKIAIOSFODNN7EXAMPLE')]);
      expect(() => filter.processInput(args)).toThrow(TripWire);
    });

    it('urls preset detects URLs', () => {
      const filter = new RegexFilterProcessor({
        presets: ['urls'],
        strategy: 'block',
      });

      const args = createInputArgs([createMessage('Visit https://example.com/path')]);
      expect(() => filter.processInput(args)).toThrow(TripWire);
    });

    it('multiple presets can be combined', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii', 'secrets'],
        strategy: 'block',
      });

      const args1 = createInputArgs([createMessage('Email: test@test.com')]);
      expect(() => filter.processInput(args1)).toThrow(TripWire);

      const args2 = createInputArgs([createMessage('Bearer abc123def456ghi789')]);
      expect(() => filter.processInput(args2)).toThrow(TripWire);
    });
  });

  describe('processOutputResult', () => {
    it('blocks output with matches', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const args = createOutputResultArgs([createMessage('Your SSN is 123-45-6789', 'assistant')]);
      expect(() => filter.processOutputResult(args)).toThrow(TripWire);
    });

    it('redacts output content', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'redact',
      });

      const args = createOutputResultArgs([createMessage('Your email is bob@test.com', 'assistant')]);
      const result = filter.processOutputResult(args) as MastraDBMessage[];

      expect(result).toBeDefined();
      const content = result[0].content as any;
      expect(content.parts[0].text).toBe('Your email is [EMAIL]');
    });

    it('allows clean output', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const messages = [createMessage('The answer is 42', 'assistant')];
      const args = createOutputResultArgs(messages);
      const result = filter.processOutputResult(args);
      expect(result).toBe(messages);
    });
  });

  describe('string content redaction', () => {
    it('redacts string-form message content', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'redact',
      });

      const msg: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Contact user@example.com please' as any,
        createdAt: new Date(),
      };
      const args = createInputArgs([msg]);
      const result = filter.processInput(args) as MastraDBMessage[];

      expect(result[0].content).toBe('Contact [EMAIL] please');
    });

    it('redacts string-form message content in output', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'redact',
      });

      const msg: MastraDBMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Your SSN is 123-45-6789' as any,
        createdAt: new Date(),
      };
      const args = createOutputResultArgs([msg]);
      const result = filter.processOutputResult(args) as MastraDBMessage[];

      expect(result[0].content).toBe('Your SSN is [SSN]');
    });
  });

  describe('edge cases', () => {
    it('redacts text parts in structured content', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'redact',
      });

      const msg: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text' as const, text: 'Email: test@test.com' }] },
        createdAt: new Date(),
      };
      const args = createInputArgs([msg]);
      const result = filter.processInput(args) as MastraDBMessage[];

      expect(result).toBeDefined();
      const content = result[0].content as any;
      expect(content.parts[0].text).toBe('Email: [EMAIL]');
    });

    it('handles messages without text parts', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const msg: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'image' as any, url: 'http://img.png' }] } as any,
        createdAt: new Date(),
      };
      const messages = [msg];
      const args = createInputArgs(messages);
      const result = filter.processInput(args);
      expect(result).toBe(messages);
    });

    it('handles multiple messages', () => {
      const filter = new RegexFilterProcessor({
        presets: ['pii'],
        strategy: 'block',
      });

      const args = createInputArgs([createMessage('Hello there'), createMessage('My email is test@test.com')]);
      expect(() => filter.processInput(args)).toThrow(TripWire);
    });
  });
});
