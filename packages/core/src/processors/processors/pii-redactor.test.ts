import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraDBMessage, MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
import type { ProcessInputArgs, ProcessOutputResultArgs, ProcessOutputStreamArgs } from '../index';
import { PIIRedactor } from './pii-redactor';

/** Build a V2 user or assistant message whose single text part holds `text`. */
function createMessage(text: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage {
  return {
    id: `msg-${Math.random()}`,
    role,
    content: { format: 2, parts: [{ type: 'text' as const, text }] },
    createdAt: new Date(),
  };
}

/** Wrap messages in the argument shape `processInput` expects. */
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

/** Wrap messages in the argument shape `processOutputResult` expects. */
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

/** Build a text-delta stream chunk carrying `text`. */
function createTextChunk(text: string): ChunkType {
  return {
    type: 'text-delta',
    payload: { text, id: 'text-1' },
    runId: 'run-1',
    from: ChunkFrom.AGENT,
  };
}

/** Wrap a chunk in the argument shape `processOutputStream` expects, with carry-over state. */
function createStreamArgs(part: ChunkType, state: Record<string, any> = {}): ProcessOutputStreamArgs {
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

/** Read the text of a message's first text part. */
function getText(message: MastraDBMessage): string {
  const part = message.content.parts?.[0];
  return part && part.type === 'text' && 'text' in part ? (part.text as string) : '';
}

describe('PIIRedactor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('throws if no detection types are provided', () => {
      expect(() => new PIIRedactor({ detectionTypes: [] })).toThrow('PIIRedactor requires at least one detection type');
    });

    it('throws for LLM-only types with a pointer to PIIDetector', () => {
      expect(() => new PIIRedactor({ detectionTypes: ['name' as any] })).toThrow(/use PIIDetector with a model/);
    });

    it('throws for unknown types', () => {
      expect(() => new PIIRedactor({ detectionTypes: ['passport' as any] })).toThrow(/not a regex-detectable PII type/);
    });

    it('accepts regex-detectable types', () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email', 'phone'] });
      expect(redactor.id).toBe('pii-redactor');
      expect(redactor.name).toBe('PII Redactor');
    });
  });

  describe('processInput - redact strategy (default)', () => {
    it('masks email addresses while preserving format', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'] });
      const result = await redactor.processInput(createInputArgs([createMessage('Contact me at test@example.com')]));

      const messages = result as MastraDBMessage[];
      const text = getText(messages[0]!);
      expect(text).not.toContain('test@example.com');
      expect(text).toContain('@');
      expect(text).toContain('Contact me at');
    });

    it('replaces values with placeholders when redactionMethod is placeholder', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email', 'ssn'], redactionMethod: 'placeholder' });
      const result = await redactor.processInput(
        createInputArgs([createMessage('Email test@example.com and SSN 123-45-6789')]),
      );

      const text = getText((result as MastraDBMessage[])[0]!);
      expect(text).toBe('Email [EMAIL] and SSN [SSN]');
    });

    it('hashes values when redactionMethod is hash', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], redactionMethod: 'hash' });
      const result = await redactor.processInput(createInputArgs([createMessage('test@example.com')]));

      const text = getText((result as MastraDBMessage[])[0]!);
      expect(text).toMatch(/^\[HASH:[0-9a-f]{8}\]$/);
    });

    it('removes values when redactionMethod is remove', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], redactionMethod: 'remove' });
      const result = await redactor.processInput(createInputArgs([createMessage('before test@example.com after')]));

      const text = getText((result as MastraDBMessage[])[0]!);
      expect(text).toBe('before  after');
    });

    it('preserves non-text parts and message fields', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], redactionMethod: 'placeholder' });
      const message: MastraDBMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'step-start' } as any, { type: 'text' as const, text: 'reach me at test@example.com' }],
        },
        createdAt: new Date(),
      };

      const result = (await redactor.processInput(createInputArgs([message]))) as MastraDBMessage[];
      expect(result[0]!.id).toBe('msg-1');
      expect(result[0]!.content.parts?.[0]).toEqual({ type: 'step-start' });
      const textPart = result[0]!.content.parts?.[1];
      expect(textPart && 'text' in textPart ? textPart.text : '').toBe('reach me at [EMAIL]');
    });

    it('redacts PII that only the flattened content carries', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], redactionMethod: 'placeholder' });
      const message: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text' as const, text: 'nothing sensitive here' }],
          content: 'nothing sensitive here, but also test@example.com',
        },
        createdAt: new Date(),
      };

      const result = (await redactor.processInput(createInputArgs([message]))) as MastraDBMessage[];

      expect(result[0]!.content.content).toBe('nothing sensitive here, but also [EMAIL]');
    });

    it('reports one detection when a part and the flattened content hold the same text', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], strategy: 'block' });
      const message: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text' as const, text: 'leak test@example.com' }],
          content: 'leak test@example.com',
        },
        createdAt: new Date(),
      };

      try {
        await redactor.processInput(createInputArgs([message]));
        expect.fail('Expected TripWire');
      } catch (error) {
        expect((error as TripWire<any>).options.metadata).toMatchObject({ detectionCount: 1 });
      }
    });

    it('returns messages unchanged when no PII is found', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email', 'phone'] });
      const messages = [createMessage('nothing sensitive here')];
      const result = await redactor.processInput(createInputArgs(messages));
      expect(result).toBe(messages);
    });

    it('keeps the earlier, longer match when detection spans overlap', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email', 'url'], redactionMethod: 'placeholder' });
      const result = await redactor.processInput(
        createInputArgs([createMessage('see https://example.com/u/a@b.io done')]),
      );

      expect(getText((result as MastraDBMessage[])[0]!)).toBe('see [URL] done');
    });

    it('does not garble text when two types match the same digits', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['phone', 'credit-card'], redactionMethod: 'placeholder' });
      const result = await redactor.processInput(createInputArgs([createMessage('card 4111-1111-1111-1111 end')]));

      expect(getText((result as MastraDBMessage[])[0]!)).toBe('card [CREDIT-CARD] end');
    });

    it('only checks the last message when lastMessageOnly is set', async () => {
      const redactor = new PIIRedactor({
        detectionTypes: ['email'],
        redactionMethod: 'placeholder',
        lastMessageOnly: true,
      });
      const first = createMessage('old email test@example.com');
      const last = createMessage('new email new@example.com');
      const result = (await redactor.processInput(createInputArgs([first, last]))) as MastraDBMessage[];

      expect(getText(result[0]!)).toBe('old email test@example.com');
      expect(getText(result[1]!)).toBe('new email [EMAIL]');
    });
  });

  describe('processInput - other strategies', () => {
    it('block throws a TripWire with type metadata and no raw values', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], strategy: 'block' });
      try {
        await redactor.processInput(createInputArgs([createMessage('leak test@example.com')]));
        expect.fail('Expected TripWire');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        const tripwire = error as TripWire<any>;
        expect(tripwire.options.metadata).toMatchObject({
          processorId: 'pii-redactor',
          strategy: 'block',
          detectedTypes: ['email'],
          detectionCount: 1,
        });
        expect(JSON.stringify(tripwire.options.metadata)).not.toContain('test@example.com');
      }
    });

    it('warn logs and passes messages through unchanged', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], strategy: 'warn' });
      const messages = [createMessage('email test@example.com')];
      const result = await redactor.processInput(createInputArgs(messages));

      expect(result).toBe(messages);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('email'));
    });

    it('block catches PII that only the flattened content carries', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], strategy: 'block' });
      const message: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text' as const, text: 'all clear' }],
          content: 'all clear, and test@example.com',
        },
        createdAt: new Date(),
      };

      try {
        await redactor.processInput(createInputArgs([message]));
        expect.fail('Expected TripWire');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        expect((error as TripWire<any>).options.metadata).toMatchObject({ detectedTypes: ['email'] });
      }
    });

    it('filter drops flagged messages and keeps clean ones', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], strategy: 'filter' });
      const clean = createMessage('all clear');
      const flagged = createMessage('email test@example.com');
      const result = (await redactor.processInput(createInputArgs([clean, flagged]))) as MastraDBMessage[];

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(clean.id);
    });
  });

  describe('processOutputResult', () => {
    it('redacts assistant output', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['phone'], redactionMethod: 'placeholder' });
      const result = await redactor.processOutputResult(
        createOutputResultArgs([createMessage('call 555-123-4567 today', 'assistant')]),
      );

      expect(getText((result as MastraDBMessage[])[0]!)).toBe('call [PHONE] today');
    });
  });

  describe('processOutputStream', () => {
    it('passes clean chunks through unchanged', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'] });
      const part = createTextChunk('hello world');
      const result = await redactor.processOutputStream(createStreamArgs(part));
      expect(result).toBe(part);
    });

    it('passes non-text chunks through unchanged', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'] });
      const part = { type: 'tool-call', payload: {}, runId: 'run-1', from: ChunkFrom.AGENT } as unknown as ChunkType;
      const result = await redactor.processOutputStream(createStreamArgs(part));
      expect(result).toBe(part);
    });

    it('redacts PII inside a single chunk', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], redactionMethod: 'placeholder' });
      const result = await redactor.processOutputStream(createStreamArgs(createTextChunk('mail test@example.com ok')));

      expect(result && result.type === 'text-delta' ? result.payload.text : '').toBe('mail [EMAIL] ok');
    });

    it('detects PII split across chunk boundaries via carryover', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], redactionMethod: 'placeholder' });
      const state: Record<string, any> = {};

      const first = await redactor.processOutputStream(createStreamArgs(createTextChunk('contact test@'), state));
      expect(first && first.type === 'text-delta' ? first.payload.text : '').toBe('contact test@');

      const second = await redactor.processOutputStream(createStreamArgs(createTextChunk('example.com now'), state));
      expect(second && second.type === 'text-delta' ? second.payload.text : '').toBe('[EMAIL] now');
    });

    it('does not re-flag PII that was fully contained in the carryover tail', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], redactionMethod: 'placeholder' });
      const state: Record<string, any> = {};

      await redactor.processOutputStream(createStreamArgs(createTextChunk('mail test@example.com done'), state));
      const next = await redactor.processOutputStream(createStreamArgs(createTextChunk(' more text'), state));
      expect(next && next.type === 'text-delta' ? next.payload.text : '').toBe(' more text');
    });

    it('block strategy throws a TripWire on streaming PII', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], strategy: 'block' });
      await expect(
        redactor.processOutputStream(createStreamArgs(createTextChunk('leak test@example.com'))),
      ).rejects.toBeInstanceOf(TripWire);
    });

    it('filter strategy drops the chunk', async () => {
      const redactor = new PIIRedactor({ detectionTypes: ['email'], strategy: 'filter' });
      const result = await redactor.processOutputStream(createStreamArgs(createTextChunk('leak test@example.com')));
      expect(result).toBeNull();
    });
  });
});
