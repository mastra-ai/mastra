import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraDBMessage, MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { ChunkType } from '../../stream';
import type { ProcessInputArgs, ProcessOutputResultArgs, ProcessOutputStreamArgs } from '../index';
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

function createStreamArgs(part: ChunkType): ProcessOutputStreamArgs {
  return {
    part,
    streamParts: [],
    abort: ((reason?: string) => {
      throw new TripWire(reason ?? 'aborted', { retry: false });
    }) as any,
    retryCount: 0,
    model: { modelId: 'test', provider: 'test', specificationVersion: 'v2' } as any,
    state: {},
  };
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

      const part = {
        type: 'text-delta',
        runId: 'r',
        from: 'AGENT',
        payload: { id: 't1', text: 'Email: test@test.com' },
      } as unknown as ChunkType;
      const args = createStreamArgs(part);
      const result = await filter.processOutputStream(args);

      expect(result).toBeDefined();
      expect((result as any).payload.text).toContain('[EMAIL]');
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
