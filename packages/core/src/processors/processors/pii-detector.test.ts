import type { TextPart } from '@internal/ai-sdk-v4';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraDBMessage } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import { MastraLanguageModelV2Mock } from '../../loop/test-utils/MastraLanguageModelV2Mock';
import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
import { REPROCESS_PART_KEY } from '../stream-reprocess';
import type { PIIDetectionResult, PIIDetection } from './pii-detector';
import { PIIDetector } from './pii-detector';

/** Detection types that are handled by regex only (no LLM buffering) */
const REGEX_ONLY_TYPES = [
  'email',
  'phone',
  'credit-card',
  'ssn',
  'api-key',
  'ip-address',
  'url',
  'uuid',
  'crypto-wallet',
  'iban',
];

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

function createMockPIIResult(
  piiTypes: string[] = [],
  detections: PIIDetection[] = [],
  redactedContent?: string | null,
): PIIDetectionResult {
  const result: PIIDetectionResult = {
    categories:
      piiTypes.length > 0
        ? piiTypes.map(type => ({ type, score: 0.8 })) // High confidence score for detected types
        : null,
    detections: detections.length > 0 ? detections : null,
    // Always include redacted_content for default 'redact' strategy (null if not provided)
    redacted_content: redactedContent !== undefined ? redactedContent : null,
  };

  return result;
}

function setupMockModel(result: PIIDetectionResult | PIIDetectionResult[]): MockLanguageModelV1 {
  const results = Array.isArray(result) ? result : [result];
  let callCount = 0;

  return new MockLanguageModelV1({
    defaultObjectGenerationMode: 'json',
    doGenerate: async () => {
      const currentResult = results[callCount % results.length];
      callCount++;

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: JSON.stringify(currentResult),
      };
    },
  });
}

describe('PIIDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should return messages unchanged when no PII is detected', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('Hello world')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
    });

    it('should handle empty messages array', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model });

      const result = await detector.processInput({ messages: [], abort: vi.fn() as any });

      expect(result).toEqual([]);
    });

    it('should handle messages with no text content', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model });
      const messages = [
        {
          id: 'test-id',
          role: 'user' as const,
          content: { format: 2 as const, parts: [] },
          createdAt: new Date(),
        },
      ];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
    });

    it('should handle messages with empty text content', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
    });
  });

  describe('PII detection with default strategy (redact)', () => {
    it('should detect and redact email addresses', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
          start: 12,
          end: 28,
          redacted_value: null,
        },
      ];
      const model = setupMockModel(createMockPIIResult(['email'], detections, 'My email is t**t@*******.com'));
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('My email is test@example.com')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'My email is t**t@*******.com',
      });
    });

    it('should detect and redact phone numbers', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'phone',
          value: '(555) 123-4567',
          confidence: 0.85,
          start: 19,
          end: 33,
          redacted_value: null,
        },
      ];
      const model = setupMockModel(createMockPIIResult(['phone'], detections, 'My phone number is (XXX) XXX-4567'));
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('My phone number is (555) 123-4567')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'My phone number is (XXX) XXX-4567',
      });
    });

    it('should detect and redact credit card numbers', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'credit-card',
          value: '4111-1111-1111-1111',
          confidence: 0.95,
          start: 8,
          end: 27,
          redacted_value: null,
        },
      ];
      const model = setupMockModel(createMockPIIResult(['credit-card'], detections, 'Card: 41****-****-****-1111'));
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('Card: 4111-1111-1111-1111')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'Card: 41****-****-****-1111',
      });
    });

    it('should handle messages without redacted_content by using built-in redaction', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('Hello world')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
    });

    it('should only inspect the last message when lastMessageOnly is enabled', async () => {
      const model = setupMockModel(createMockPIIResult([], []));
      const detector = new PIIDetector({ model, lastMessageOnly: true });
      const messages = [
        createTestMessage('My email is secret@example.com', 'user', 'msg1'),
        createTestMessage('No sensitive data here', 'user', 'msg2'),
      ];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toEqual(messages);
    });

    it('should detect multiple PII types', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
          start: 12,
          end: 28,
          redacted_value: null,
        },
        {
          type: 'api-key',
          value: 'sk_test_123456789',
          confidence: 0.95,
          start: 36,
          end: 51,
          redacted_value: null,
        },
      ];
      const model = setupMockModel(
        createMockPIIResult(
          ['email', 'api-key'],
          detections,
          'My email is t**t@*******.com and keys***************9789',
        ),
      );
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('My email is test@example.com and key sk_test_123456789')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'My email is t**t@*******.com and keys***************9789',
      });
    });

    it('should handle multiple messages', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'phone',
          value: '555-1234',
          confidence: 0.8,
          start: 19,
          end: 27,
          redacted_value: null,
        },
      ];
      const model = setupMockModel([
        createMockPIIResult(), // No PII for first message
        createMockPIIResult(['phone'], detections, 'My phone number is XXX-1234'), // PII for second message with redacted content
      ]);
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('Hello world'), createTestMessage('My phone number is 555-1234')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(messages[0]); // First message unchanged
      expect(result[1].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'My phone number is XXX-1234',
      });
    });
  });

  describe('strategy: block', () => {
    it('should abort when PII is detected with block strategy', async () => {
      const model = setupMockModel([createMockPIIResult(), createMockPIIResult(['email'])]);
      const detector = new PIIDetector({ model, strategy: 'block' });
      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('PII detected');
      });
      const messages = [createTestMessage('Hello world'), createTestMessage('My email is test@example.com')];

      await expect(detector.processInput({ messages, abort: mockAbort as any })).rejects.toThrow('PII detected');

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('PII detected'));
    });

    it('should process all messages if no PII is detected', async () => {
      const model = setupMockModel(createMockPIIResult(['email']));
      const detector = new PIIDetector({ model, strategy: 'block' });
      const messages = [createTestMessage('Hello world')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
    });
  });

  describe('strategy: filter', () => {
    it('should remove messages containing PII', async () => {
      const detections = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
          start: 12,
          end: 28,
        },
      ];
      const redactedContent = 'My email is [REDACTED]';
      const model = setupMockModel(createMockPIIResult(['email'], detections, redactedContent));
      const detector = new PIIDetector({ model, strategy: 'filter' });
      const messages = [createTestMessage('My email is test@example.com')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(0);
    });

    it('should return empty array if all messages contain PII', async () => {
      const model = setupMockModel(createMockPIIResult(['ssn'])); // No redacted_content
      const detector = new PIIDetector({ model, strategy: 'filter' });
      const messages = [createTestMessage('SSN: 123-45-6789'), createTestMessage('Another SSN: 987-65-4321')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(0);
    });

    it('should handle mixed content with different redaction outcomes', async () => {
      const detections = [
        {
          type: 'phone',
          value: '555-1234',
          confidence: 0.8,
          start: 19,
          end: 27,
        },
      ];
      const redactedContent = 'My phone number is [REDACTED]';
      const model = setupMockModel([
        createMockPIIResult(),
        createMockPIIResult(['phone'], detections, redactedContent),
        createMockPIIResult(['credit-card']), // No redaction
      ]);
      const detector = new PIIDetector({ model, strategy: 'filter' });
      const messages = [
        createTestMessage('Hello world'), // No PII
        createTestMessage('My phone number is 555-1234'), // PII with redaction
        createTestMessage('Credit card: 1234-5678-9012-3456'), // PII without redaction
      ];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]); // Only non-PII message remains
    });
  });

  describe('strategy: warn', () => {
    it('should log warning but continue processing', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const model = setupMockModel(createMockPIIResult(['email']));
      const detector = new PIIDetector({ model, strategy: 'warn' });
      const messages = [createTestMessage('My email is test@example.com')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PII detected'));

      consoleSpy.mockRestore();
    });
  });

  describe('strategy: redact', () => {
    it('should use provided redacted content when available', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
          start: 12,
          end: 28,
          redacted_value: null,
        },
      ];
      const redactedContent = 'My email is [EMAIL]';
      const model = setupMockModel(createMockPIIResult(['email'], detections, redactedContent));
      const detector = new PIIDetector({ model, strategy: 'redact' });
      const messages = [createTestMessage('My email is test@example.com')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'My email is [EMAIL]',
      });
    });

    it('should filter message if no redacted content is available', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'email',
          value: 'john@example.com',
          confidence: 0.9,
          start: 14,
          end: 30,
          redacted_value: 'j***@***.com',
        },
      ];
      const redactedContent = 'Contact me at j***@***.com for info';
      const model = setupMockModel(createMockPIIResult(['email'], detections, redactedContent));
      const detector = new PIIDetector({ model, strategy: 'redact' });
      const messages = [createTestMessage('Contact me at john@example.com for info', 'user', 'msg1')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: redactedContent,
      });
    });
  });

  describe('redaction methods', () => {
    it('should support different redaction methods', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
          start: 0,
          end: 16,
          redacted_value: '[EMAIL]',
        },
        {
          type: 'phone',
          value: '555-1234',
          confidence: 0.8,
          start: 20,
          end: 28,
          redacted_value: '[PHONE]',
        },
      ];
      const redactedContent = '[EMAIL] and [PHONE]';
      const model = setupMockModel(createMockPIIResult(['email', 'phone'], detections, redactedContent));
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
        redactionMethod: 'placeholder',
      });
      const messages = [createTestMessage('test@example.com and 555-1234', 'user')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: redactedContent,
      });
    });
  });

  describe('threshold handling', () => {
    it('should respect custom threshold', async () => {
      const detections = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.7,
          start: 0,
          end: 16,
        },
      ];
      const mockResult = createMockPIIResult(['email'], detections);
      // Set score to 0.7 (above threshold of 0.6)
      if (mockResult.categories) {
        mockResult.categories[0].score = 0.7;
      }

      const model = setupMockModel(mockResult);
      const detector = new PIIDetector({ model, threshold: 0.6, strategy: 'block' });
      const messages = [createTestMessage('test@example.com')];

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('PII detected');
      });

      await expect(detector.processInput({ messages, abort: mockAbort as any })).rejects.toThrow();
    });

    it('should not trigger when below threshold', async () => {
      const mockResult = createMockPIIResult(['email']);
      // Set score to 0.3 (below threshold of 0.6)
      if (mockResult.categories) {
        mockResult.categories[0].score = 0.3;
      }

      const model = setupMockModel(mockResult);
      const detector = new PIIDetector({ model, threshold: 0.6 });
      const messages = [createTestMessage('test@example.com')];

      const result = await detector.processInput({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
    });
  });

  describe('custom detection types', () => {
    it('should work with custom PII types', async () => {
      const mockResult: PIIDetectionResult = {
        categories: [{ type: 'employee-id', score: 0.9 }],
        detections: [
          {
            type: 'employee-id',
            value: 'EMP-12345',
            confidence: 0.9,
            start: 0,
            end: 9,
          },
        ],
        redacted_content: null,
      };
      const model = setupMockModel(mockResult);
      const detector = new PIIDetector({
        model,
        detectionTypes: ['employee-id', 'customer-id'],
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('Custom PII blocked');
      });

      const messages = [createTestMessage('EMP-12345 submitted the report', 'user')];

      await expect(async () => {
        await detector.processInput({ messages, abort: mockAbort as any });
      }).rejects.toThrow('Custom PII blocked');

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('employee-id'));
    });
  });

  describe('content extraction', () => {
    it('should extract text from parts array', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({
        model,
      });

      const mockAbort = vi.fn();

      const message: MastraDBMessage = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Email me at ' },
            { type: 'step-start' },
            { type: 'text', text: 'john@example.com' },
          ],
        },
        createdAt: new Date(),
      };

      await detector.processInput({ messages: [message], abort: mockAbort as any });

      // The model should have been called with the concatenated text
      // We can't easily verify the exact call without exposing internals,
      // but we can verify the process completed successfully
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should extract text from content field', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({
        model,
      });

      const mockAbort = vi.fn();

      const message: MastraDBMessage = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Call me at ' }],
          content: '555-1234',
        },
        createdAt: new Date(),
      };

      await detector.processInput({ messages: [message], abort: mockAbort as any });

      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should skip messages with no text content', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({
        model,
      });

      const mockAbort = vi.fn();

      const message: MastraDBMessage = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'step-start' }],
        },
        createdAt: new Date(),
      };

      const result = await detector.processInput({ messages: [message], abort: mockAbort as any });

      expect(result).toEqual([message]);
      // Model should not have been called for empty text
    });
  });

  describe('error handling', () => {
    it('should fail open when detection agent fails', async () => {
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          throw new TripWire('Detection agent failed');
        },
      });
      const detector = new PIIDetector({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages = [createTestMessage('test@example.com', 'user')];
      const result = await detector.processInput({ messages, abort: mockAbort as any });

      expect(result).toEqual(messages); // Should allow content through
      expect(mockAbort).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PIIDetector] Detection agent failed'),
        expect.anything(),
      );

      consoleWarnSpy.mockRestore();
    });

    it.each(['processInput', 'processOutputResult'] as const)(
      'should propagate the processor tripwire from %s when strict model detection fails',
      async method => {
        const model = new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => {
            throw new Error('provider failure');
          },
        });
        const detector = new PIIDetector({ model, detectionTypes: ['name'], errorStrategy: 'strict' });
        const tripwire = new TripWire('strict PII failure');
        const abort = vi.fn(() => {
          throw tripwire;
        });

        await expect(
          detector[method]({
            messages: [
              createTestMessage('Alice lives nearby', method === 'processOutputResult' ? 'assistant' : 'user'),
            ],
            abort: abort as any,
          }),
        ).rejects.toBe(tripwire);
        expect(abort).toHaveBeenCalledWith('PII detection failed because the internal model call failed');
      },
    );

    it('should propagate the processor tripwire when legacy detection returns no object', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, detectionTypes: ['name'], strategy: 'block', errorStrategy: 'strict' });
      vi.spyOn((detector as any).detectionAgent, 'generateLegacy').mockResolvedValue({ object: undefined });
      const tripwire = new TripWire('strict PII failure');
      const abort = vi.fn(() => {
        throw tripwire;
      });

      await expect(
        detector.processInput({ messages: [createTestMessage('Alice lives nearby')], abort: abort as any }),
      ).rejects.toBe(tripwire);
      expect(abort).toHaveBeenCalledWith('PII detection failed because the internal model call failed');
    });

    it('should not emit buffered text when strict streaming model detection fails', async () => {
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          throw new Error('provider failure');
        },
      });
      const detector = new PIIDetector({
        model,
        detectionTypes: ['name'],
        errorStrategy: 'strict',
        bufferSize: 1,
      });
      const tripwire = new TripWire('strict PII failure');
      const abort = vi.fn(() => {
        throw tripwire;
      });
      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Alice lives nearby.', id: 'text-1' },
        runId: 'run-1',
        from: ChunkFrom.AGENT,
      };

      await expect(
        detector.processOutputStream({ part, streamParts: [part], state: {}, abort: abort as any }),
      ).rejects.toBe(tripwire);
      expect(abort).toHaveBeenCalledWith('PII detection failed because the internal model call failed');
    });

    it('should handle empty message array', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({
        model,
      });

      const mockAbort = vi.fn();
      const result = await detector.processInput({ messages: [], abort: mockAbort as any });

      expect(result).toEqual([]);
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should not abort on non-tripwire errors during processing', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({
        model,
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('Processing failed');
      });

      // Force an error during processing
      const invalidMessage = null as any;

      await expect(async () => {
        await detector.processInput({ messages: [invalidMessage], abort: mockAbort as any });
      }).rejects.toThrow();

      expect(mockAbort).not.toHaveBeenCalled();
    });
  });

  describe('configuration options', () => {
    it('should include detection details when includeDetections is enabled', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
          start: 0,
          end: 16,
        },
      ];
      const model = setupMockModel(createMockPIIResult(['email'], detections));
      const detector = new PIIDetector({
        model,
        strategy: 'warn',
        includeDetections: true,
      });

      const mockAbort = vi.fn();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages = [createTestMessage('test@example.com', 'user')];
      await detector.processInput({ messages, abort: mockAbort as any });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Detections: 1 items'));

      consoleSpy.mockRestore();
    });

    it('should use custom instructions when provided', () => {
      const customInstructions = 'Custom PII detection instructions for testing';
      const model = setupMockModel(createMockPIIResult());

      const detector = new PIIDetector({
        model,
        instructions: customInstructions,
      });

      expect(detector.id).toBe('pii-detector');
    });
  });

  describe('edge cases', () => {
    it('should handle malformed detection results gracefully', async () => {
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: 'invalid json',
        }),
      });
      const detector = new PIIDetector({
        model,
        strategy: 'warn',
      });

      const mockAbort = vi.fn();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages = [createTestMessage('test@example.com', 'user')];
      const result = await detector.processInput({ messages, abort: mockAbort as any });

      // Should fail open and allow content
      expect(result).toEqual(messages);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle very long content', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({
        model,
      });

      const mockAbort = vi.fn();

      const longText = 'test@example.com '.repeat(100);
      const messages = [createTestMessage(longText, 'user')];

      const result = await detector.processInput({ messages, abort: mockAbort as any });

      expect(result).toEqual(messages);
    });

    it('should handle multiple PII types in one message', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
          start: 0,
          end: 16,
        },
        {
          type: 'phone',
          value: '555-1234',
          confidence: 0.8,
          start: 20,
          end: 28,
        },
        {
          type: 'credit-card',
          value: '4532123456789012',
          confidence: 0.95,
          start: 32,
          end: 48,
        },
      ];
      const model = setupMockModel(createMockPIIResult(['email', 'phone', 'credit-card'], detections));
      const detector = new PIIDetector({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('Multiple PII blocked');
      });

      const messages = [createTestMessage('Complex message with multiple PII types', 'user')];

      await expect(async () => {
        await detector.processInput({ messages, abort: mockAbort as any });
      }).rejects.toThrow('Multiple PII blocked');

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('email, phone, credit-card'));
    });
  });

  describe('processOutputStream', () => {
    it('should return non-text chunks unchanged', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model });

      const part: ChunkType = {
        type: 'object' as const,
        object: { status: 'ok' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      const result = await detector.processOutputStream({
        part,
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toEqual(part);
    });

    it('should return empty text chunks unchanged', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model });

      const part: ChunkType = {
        type: 'text-delta' as const,
        payload: {
          id: 'test-id',
          text: '',
        },
        runId: 'test-run-id',
        from: ChunkFrom.USER,
      };

      const result = await detector.processOutputStream({
        part,
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toEqual(part);
    });

    it('should detect and redact PII in text chunks using regex (no LLM call)', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, detectionTypes: REGEX_ONLY_TYPES });

      const part: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'test-id',
          text: 'My email is test@example.com',
        },
        runId: 'test-run-id',
        from: ChunkFrom.USER,
      };

      const state: Record<string, any> = {};
      const result = await detector.processOutputStream({
        part,
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      const flushed = await detector.processOutputStream({
        part: {
          type: 'step-finish' as any,
          payload: {},
          runId: 'test-run-id',
          from: ChunkFrom.USER,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
      expect(flushed).not.toBeNull();
      const redactedText = (flushed as any).payload.text;
      // Regex-based redaction uses the built-in maskValue method
      expect(redactedText).not.toContain('test@example.com');
      expect(redactedText).toContain('@');
      expect(redactedText).toContain('.com');
    });

    it('should not make LLM calls during streaming (regex-only types)', async () => {
      let llmCallCount = 0;
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          llmCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { promptTokens: 10, completionTokens: 20 },
            text: JSON.stringify(createMockPIIResult()),
          };
        },
      });
      const detector = new PIIDetector({ model, detectionTypes: REGEX_ONLY_TYPES });

      const chunks = ['Hello, my email is ', 'test@example.com', ' and my phone is ', '555-123-4567'];

      for (const text of chunks) {
        await detector.processOutputStream({
          part: {
            type: 'text-delta',
            payload: { id: 'test-id', text },
            runId: 'test-run-id',
            from: ChunkFrom.AGENT,
          },
          streamParts: [],
          state: {},
          abort: vi.fn() as any,
        });
      }

      expect(llmCallCount).toBe(0);
    });

    it('should detect phone numbers via regex during streaming', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, strategy: 'filter', detectionTypes: REGEX_ONLY_TYPES });

      const part: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'test-id',
          text: 'Call me at 555-123-4567',
        },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      const result = await detector.processOutputStream({
        part,
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
    });

    it('should detect SSN via regex during streaming', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, strategy: 'filter', detectionTypes: REGEX_ONLY_TYPES });

      const part: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'test-id',
          text: 'SSN: 123-45-6789',
        },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      const result = await detector.processOutputStream({
        part,
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
    });

    it('should detect credit card numbers via regex during streaming', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, strategy: 'filter', detectionTypes: REGEX_ONLY_TYPES });

      const part: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'test-id',
          text: 'Card: 4111-1111-1111-1111',
        },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      const result = await detector.processOutputStream({
        part,
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
    });

    it('should pass through text without regex-detectable PII', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, detectionTypes: REGEX_ONLY_TYPES });

      const part: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'test-id',
          text: 'Hello, how are you today?',
        },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      const state: Record<string, any> = {};
      const result = await detector.processOutputStream({
        part,
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      const flushed = await detector.processOutputStream({
        part: {
          type: 'step-finish' as any,
          payload: {},
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
      expect(flushed).toEqual(part);
    });

    it('should block streaming content when strategy is block and PII is detected', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, strategy: 'block', detectionTypes: REGEX_ONLY_TYPES });

      const part: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'test-id',
          text: 'My email is test@example.com',
          providerMetadata: {},
        },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('PII detected in streaming content');
      });

      await expect(
        detector.processOutputStream({
          part,
          streamParts: [],
          state: {},
          abort: mockAbort as any,
        }),
      ).rejects.toThrow('PII detected in streaming content');

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('PII detected in streaming content'));
    });

    it('should filter streaming chunks when strategy is filter and PII is detected', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, strategy: 'filter', detectionTypes: REGEX_ONLY_TYPES });

      const part: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'test-id',
          text: 'My email is test@example.com',
          providerMetadata: {},
        },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      const result = await detector.processOutputStream({
        part,
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
    });

    it('should warn but allow content when strategy is warn and PII is detected', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, strategy: 'warn', detectionTypes: REGEX_ONLY_TYPES });

      const part: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'test-id',
          text: 'My email is test@example.com',
          providerMetadata: {},
        },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      const result = await detector.processOutputStream({
        part,
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toEqual(part);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PII detected in streaming content'));

      consoleSpy.mockRestore();
    });

    it('should buffer chunks when LLM-only types (name, address) are configured', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, detectionTypes: ['name', 'address'] });

      const state: Record<string, any> = {};
      const part: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'test-id',
          text: 'John Smith lives at 123 Main St',
        },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      const result = await detector.processOutputStream({
        part,
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      // LLM-only types trigger buffering — chunk is held back
      expect(result).toBeNull();
      expect(state._piiBuffer).toBe('John Smith lives at 123 Main St');
    });

    it('should detect IP addresses via regex during streaming', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, strategy: 'filter', detectionTypes: REGEX_ONLY_TYPES });

      const result = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'test-id', text: 'Server IP is 192.168.1.100' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
    });

    it('should detect UUIDs via regex during streaming', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, strategy: 'filter', detectionTypes: REGEX_ONLY_TYPES });

      const result = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'test-id', text: 'User ID: 550e8400-e29b-41d4-a716-446655440000' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
    });

    it('should detect URLs via regex during streaming', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, strategy: 'filter', detectionTypes: REGEX_ONLY_TYPES });

      const result = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'test-id', text: 'Visit https://example.com/user/profile?id=123' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
    });

    it('should redact multiple PII types in a single chunk', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, strategy: 'redact', detectionTypes: REGEX_ONLY_TYPES });

      const state: Record<string, any> = {};
      const result = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'test-id', text: 'Email: user@test.com, SSN: 123-45-6789' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      const flushed = await detector.processOutputStream({
        part: {
          type: 'step-finish' as any,
          payload: {},
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
      expect(flushed).not.toBeNull();
      const text = (flushed as any).payload.text;
      expect(text).not.toContain('user@test.com');
      expect(text).not.toContain('123-45-6789');
    });

    it('should use placeholder redaction method during streaming', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
        redactionMethod: 'placeholder',
        detectionTypes: REGEX_ONLY_TYPES,
      });

      const state: Record<string, any> = {};
      const result = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'test-id', text: 'Call 555-123-4567 now' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      const flushed = await detector.processOutputStream({
        part: { type: 'step-finish' as any, payload: {}, runId: 'test-run-id', from: ChunkFrom.AGENT },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
      expect((flushed as any).payload.text).toContain('[PHONE]');
    });

    it('should use hash redaction method during streaming', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
        redactionMethod: 'hash',
        detectionTypes: REGEX_ONLY_TYPES,
      });

      const state: Record<string, any> = {};
      const result = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'test-id', text: 'Email: hash@test.com' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      const flushed = await detector.processOutputStream({
        part: { type: 'step-finish' as any, payload: {}, runId: 'test-run-id', from: ChunkFrom.AGENT },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
      expect((flushed as any).payload.text).toBe('Email: [HASH:f94d55f1]');
    });

    it('hashes empty, Unicode, and representative PII values with UTF-8 SHA-256', async () => {
      const detector = new PIIDetector({
        model: setupMockModel(createMockPIIResult()),
        strategy: 'redact',
        redactionMethod: 'hash',
      });
      const hashValue = (detector as any).hashValue.bind(detector) as (value: string) => Promise<string>;

      await expect(hashValue('')).resolves.toBe('[HASH:e3b0c442]');
      await expect(hashValue('José')).resolves.toBe('[HASH:24c2ab65]');
      await expect(hashValue('hash@test.com')).resolves.toBe('[HASH:f94d55f1]');
    });

    it('should use remove redaction method during streaming', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
        redactionMethod: 'remove',
        detectionTypes: REGEX_ONLY_TYPES,
      });

      const state: Record<string, any> = {};
      const result = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'test-id', text: 'SSN is 123-45-6789 here' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      const flushed = await detector.processOutputStream({
        part: { type: 'step-finish' as any, payload: {}, runId: 'test-run-id', from: ChunkFrom.AGENT },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      expect(result).toBeNull();
      expect((flushed as any).payload.text).not.toContain('123-45-6789');
      expect((flushed as any).payload.text).toBe('SSN is  here');
    });
  });

  describe('regression: issue #16466 — streaming cost/latency/accuracy', () => {
    it('should make zero LLM calls with regex-only types (cost regression)', async () => {
      let llmCallCount = 0;
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          llmCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { promptTokens: 10, completionTokens: 20 },
            text: JSON.stringify(createMockPIIResult()),
          };
        },
      });
      const detector = new PIIDetector({ model, detectionTypes: REGEX_ONLY_TYPES });
      const state: Record<string, any> = {};

      // Simulate 100 streaming chunks (typical response)
      for (let i = 0; i < 100; i++) {
        await detector.processOutputStream({
          part: {
            type: 'text-delta',
            payload: { id: 'test-id', text: `chunk ${i} with data ` },
            runId: 'test-run-id',
            from: ChunkFrom.AGENT,
          },
          streamParts: [],
          state,
          abort: vi.fn() as any,
        });
      }

      // Regex-only types: zero LLM calls (before fix: 100).
      expect(llmCallCount).toBe(0);
    });

    it('should make far fewer LLM calls with LLM-only types via buffering', async () => {
      let llmCallCount = 0;
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          llmCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { promptTokens: 10, completionTokens: 20 },
            text: JSON.stringify(createMockPIIResult()),
          };
        },
      });
      // Include 'name' (LLM-only) to trigger buffering
      const detector = new PIIDetector({ model, detectionTypes: ['email', 'name'] });
      const state: Record<string, any> = {};

      // Simulate 100 streaming chunks (~20 chars each = ~2000 chars total)
      // With buffer size 200, expect ~10 flushes instead of 100 calls
      for (let i = 0; i < 100; i++) {
        await detector.processOutputStream({
          part: {
            type: 'text-delta',
            payload: { id: 'test-id', text: `chunk ${i} with data ` },
            runId: 'test-run-id',
            from: ChunkFrom.AGENT,
          },
          streamParts: [],
          state,
          abort: vi.fn() as any,
        });
      }

      // Before fix: 100 LLM calls. After fix: ~10 (buffered flushes).
      expect(llmCallCount).toBeGreaterThan(0);
      expect(llmCallCount).toBeLessThan(20);
    });

    it('should still use LLM for processOutputResult after streaming (accuracy)', async () => {
      let llmCallCount = 0;
      const detections: PIIDetection[] = [
        { type: 'name', value: 'John Smith', confidence: 0.9, start: 0, end: 10, redacted_value: null },
      ];
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          llmCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { promptTokens: 10, completionTokens: 20 },
            text: JSON.stringify(createMockPIIResult(['name'], detections, '[REDACTED] is a person')),
          };
        },
      });
      const detector = new PIIDetector({ model, detectionTypes: REGEX_ONLY_TYPES });

      // Stream chunks — no LLM calls (regex-only mode)
      const streamChunks = ['John', ' Smith', ' is a person'];
      const state: Record<string, any> = {};
      for (const text of streamChunks) {
        await detector.processOutputStream({
          part: {
            type: 'text-delta',
            payload: { id: 'test-id', text },
            runId: 'test-run-id',
            from: ChunkFrom.AGENT,
          },
          streamParts: [],
          state,
          abort: vi.fn() as any,
        });
      }
      expect(llmCallCount).toBe(0);

      // processOutputResult SHOULD use LLM for context-dependent detection
      const messages = [createTestMessage('John Smith is a person', 'assistant')];
      await detector.processOutputResult({ messages, abort: vi.fn() as any });
      expect(llmCallCount).toBe(1);
    });

    it('should process chunks without latency-inducing async calls (regex-only)', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, strategy: 'redact', detectionTypes: REGEX_ONLY_TYPES });
      const state: Record<string, any> = {};

      // Process 50 chunks — should complete without LLM calls (no async latency)
      for (let i = 0; i < 50; i++) {
        await detector.processOutputStream({
          part: {
            type: 'text-delta',
            payload: { id: 'test-id', text: `word${i} ` },
            runId: 'test-run-id',
            from: ChunkFrom.AGENT,
          },
          streamParts: [],
          state,
          abort: vi.fn() as any,
        });
      }
    });

    it('should only scan configured detection types during streaming', async () => {
      const model = setupMockModel(createMockPIIResult());
      // Only configure email detection (regex-only, no buffering)
      const detector = new PIIDetector({ model, strategy: 'filter', detectionTypes: ['email'] });

      // Phone should NOT be detected
      const phoneResult = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'test-id', text: 'Call 555-123-4567' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });
      expect(phoneResult).not.toBeNull();

      // Email SHOULD be detected
      const emailResult = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'test-id', text: 'Email: user@test.com' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });
      expect(emailResult).toBeNull();
    });

    it('should respect threshold for regex detections (always 1.0 confidence)', async () => {
      const model = setupMockModel(createMockPIIResult());
      // Set threshold very high — regex detections have confidence 1.0 so they should still flag
      const detector = new PIIDetector({
        model,
        strategy: 'filter',
        threshold: 0.99,
        detectionTypes: REGEX_ONLY_TYPES,
      });

      const result = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'test-id', text: 'Email: user@test.com' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });

      // Regex confidence is 1.0, which exceeds threshold 0.99
      expect(result).toBeNull();
    });

    it('should flush LLM buffer on non-text chunk and catch PII', async () => {
      let llmCallCount = 0;
      const detections: PIIDetection[] = [
        { type: 'name', value: 'John Smith', confidence: 0.9, start: 18, end: 28, redacted_value: '[REDACTED]' },
      ];
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          llmCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { promptTokens: 10, completionTokens: 20 },
            text: JSON.stringify(createMockPIIResult(['name'], detections, 'The user is named [REDACTED]')),
          };
        },
      });
      // Include 'name' to trigger buffering
      const detector = new PIIDetector({ model, strategy: 'block', detectionTypes: ['email', 'name'] });
      const state: Record<string, any> = {};

      // Buffer some text
      await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'test-id', text: 'The user is named John Smith' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      // Not flushed yet (under threshold, no sentence boundary)
      expect(llmCallCount).toBe(0);

      // Finish chunk triggers flush
      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('PII detected');
      });
      await expect(
        detector.processOutputStream({
          part: {
            type: 'step-finish' as any,
            payload: {},
            runId: 'test-run-id',
            from: ChunkFrom.AGENT,
          },
          streamParts: [],
          state,
          abort: mockAbort as any,
        }),
      ).rejects.toThrow('PII detected');

      // LLM was called once on flush
      expect(llmCallCount).toBe(1);
    });

    it('should flush buffer on sentence boundary during streaming', async () => {
      let llmCallCount = 0;
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          llmCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { promptTokens: 10, completionTokens: 20 },
            text: JSON.stringify(createMockPIIResult()),
          };
        },
      });
      const detector = new PIIDetector({ model, detectionTypes: ['email', 'name'] });
      const state: Record<string, any> = {};

      // First chunk: no sentence boundary, gets buffered
      const result1 = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'text-0', text: 'Hello there' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      expect(result1).toBeNull();
      expect(llmCallCount).toBe(0);

      // A short sentence remains inside the bounded regex suffix until a safe stream boundary.
      const result2 = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'text-1', text: ', how are you.' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      expect(result2).toBeNull();

      const flushed = await detector.processOutputStream({
        part: { type: 'step-finish' as any, payload: {}, runId: 'finish', from: ChunkFrom.AGENT },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      expect(flushed).not.toBeNull();
      expect((flushed as any).payload.text).toBe('Hello there, how are you.');
      expect(llmCallCount).toBe(1);
    });

    it('should respect custom bufferSize option', async () => {
      let llmCallCount = 0;
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          llmCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { promptTokens: 10, completionTokens: 20 },
            text: JSON.stringify(createMockPIIResult()),
          };
        },
      });
      // Small buffer size of 50 chars
      const detector = new PIIDetector({ model, detectionTypes: ['email', 'name'], bufferSize: 50 });
      const state: Record<string, any> = {};

      // Exceed the 128-character regex carryover plus the 50-character LLM buffer.
      await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'text-0', text: 'a'.repeat(190) },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      // Buffer exceeded 50 chars, should have flushed
      expect(llmCallCount).toBe(1);
      expect(state._piiBuffer).toBe('');
    });

    it('should catch PII split across chunk boundaries via regex carryover', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model, strategy: 'filter', detectionTypes: REGEX_ONLY_TYPES });
      const state: Record<string, any> = {};

      // First chunk: email prefix only
      const result1 = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'text-0', text: 'Contact test@' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      // No full email yet — should pass through
      expect(result1).not.toBeNull();

      // Second chunk: completes the email
      const result2 = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'text-1', text: 'example.com is here' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      // Now the carryover + new chunk forms "test@example.com" — should filter
      expect(result2).toBeNull();
    });

    it('should redact PII split across chunks correctly', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
        redactionMethod: 'placeholder',
        detectionTypes: REGEX_ONLY_TYPES,
      });
      const state: Record<string, any> = {};
      const emitted: ChunkType[] = [];

      for (const part of [
        {
          type: 'text-delta' as const,
          payload: { id: 'text-0', text: 'SSN is 123-' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        {
          type: 'text-delta' as const,
          payload: { id: 'text-1', text: '45-6789 end' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        {
          type: 'step-finish' as any,
          payload: {},
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
      ]) {
        const result = await detector.processOutputStream({
          part,
          streamParts: [],
          state,
          abort: vi.fn() as any,
        });
        if (result) emitted.push(result);
      }

      const text = emitted
        .filter((part): part is ChunkType & { type: 'text-delta' } => part.type === 'text-delta')
        .map(part => part.payload.text)
        .join('');
      expect(text).toBe('SSN is [SSN] end');
    });

    it('withholds split email before redact emission', async () => {
      const detector = new PIIDetector({
        model: setupMockModel(createMockPIIResult()),
        strategy: 'redact',
        redactionMethod: 'placeholder',
        detectionTypes: ['email'],
      });
      const state: Record<string, any> = {};

      const first = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'text-0', text: 'Contact secret@' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      const second = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'text-1', text: 'example.com now' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      const flushed = await detector.processOutputStream({
        part: {
          type: 'step-finish' as any,
          payload: {},
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      expect(first).toBeNull();
      expect(second).toBeNull();
      expect((flushed as any)?.payload.text).toBe('Contact [EMAIL] now');
    });

    it('merges overlapping PII detections for every redaction method', () => {
      const content = 'before abcdefghijklmnop after';
      const detections: PIIDetection[] = [
        { type: 'email', value: 'abcdefghijkl', confidence: 1, start: 7, end: 19, redacted_value: null },
        { type: 'url', value: 'ijklmnop', confidence: 1, start: 15, end: 23, redacted_value: null },
      ];

      for (const [redactionMethod, expected] of [
        ['mask', 'before ******** after'],
        ['hash', expect.stringMatching(/^before \[HASH:[a-f0-9]{8}\] after$/)],
        ['remove', 'before  after'],
        ['placeholder', 'before [EMAIL] after'],
      ] as const) {
        const detector = new PIIDetector({
          model: setupMockModel(createMockPIIResult()),
          redactionMethod,
        });
        expect((detector as any).applyRedactionMethod(content, detections)).toEqual(expected);
      }
    });

    it('flushes held regex text before non-text parts with and without a writer', async () => {
      const finishPart = {
        type: 'step-finish' as any,
        payload: { stepId: 'step-1' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      for (const writer of [undefined, {} as any]) {
        const detector = new PIIDetector({
          model: setupMockModel(createMockPIIResult()),
          strategy: 'redact',
          redactionMethod: 'placeholder',
          detectionTypes: ['email'],
        });
        const state: Record<string, any> = {};

        await detector.processOutputStream({
          part: {
            type: 'text-delta',
            payload: { id: 'text-0', text: 'Contact secret@example.com' },
            runId: 'test-run-id',
            from: ChunkFrom.AGENT,
          },
          streamParts: [],
          state,
          abort: vi.fn() as any,
          writer,
        });
        const flushed = await detector.processOutputStream({
          part: finishPart,
          streamParts: [],
          state,
          abort: vi.fn() as any,
          writer,
        });

        expect((flushed as any)?.payload.text).toBe('Contact [EMAIL]');
        if (writer) {
          expect(state[REPROCESS_PART_KEY]).toEqual(finishPart);
          expect(state._piiPendingNonText).toBeUndefined();
        } else {
          expect(state._piiPendingNonText).toEqual([finishPart]);
          expect(state[REPROCESS_PART_KEY]).toBeUndefined();
        }
      }
    });

    it('preserves whitespace and benign partial continuations exactly once', async () => {
      const detector = new PIIDetector({
        model: setupMockModel(createMockPIIResult()),
        strategy: 'redact',
        detectionTypes: ['email', 'ssn'],
      });
      const state: Record<string, any> = {};
      const emitted: string[] = [];

      for (const [id, text] of [
        ['text-0', 'literal@'],
        ['text-1', ' '],
        ['text-2', 'and 123-'],
        ['text-3', 'not-an-ssn'],
      ]) {
        const result = await detector.processOutputStream({
          part: {
            type: 'text-delta',
            payload: { id, text },
            runId: 'test-run-id',
            from: ChunkFrom.AGENT,
          },
          streamParts: [],
          state,
          abort: vi.fn() as any,
        });
        if (result?.type === 'text-delta') emitted.push(result.payload.text);
      }

      const finishPart = {
        type: 'step-finish' as any,
        payload: { stepId: 'step-1' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const flushed = await detector.processOutputStream({
        part: finishPart,
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      if (flushed?.type === 'text-delta') emitted.push(flushed.payload.text);

      expect(emitted.join('')).toBe('literal@ and 123-not-an-ssn');
      expect(state._piiPendingNonText).toEqual([finishPart]);
    });

    it('flushes mixed regex and LLM buffers once before non-text parts', async () => {
      let llmCallCount = 0;
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          llmCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { promptTokens: 10, completionTokens: 20 },
            text: JSON.stringify(createMockPIIResult()),
          };
        },
      });
      const events: any[] = [];
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
        redactionMethod: 'placeholder',
        detectionTypes: ['email', 'name'],
        onDetection: event => void events.push(event),
      });
      const state: Record<string, any> = {};

      await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'first-payload', text: 'Contact secret@' },
          runId: 'first-run',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'second-payload', text: 'example.com' },
          runId: 'second-run',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      const finishPart = {
        type: 'step-finish' as any,
        payload: { stepId: 'step-1' },
        runId: 'finish-run',
        from: ChunkFrom.AGENT,
      };
      const flushed = await detector.processOutputStream({
        part: finishPart,
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      expect(llmCallCount).toBe(1);
      expect(flushed).toMatchObject({
        type: 'text-delta',
        payload: { id: 'first-payload', text: 'Contact [EMAIL]' },
        runId: 'first-run',
      });
      expect(state._piiPendingNonText).toEqual([finishPart]);
      expect(events.filter(event => event.detectionResult.detections?.length)).toHaveLength(1);
      expect(events.find(event => event.detectionResult.detections?.length)?.detectionResult.detections).toMatchObject([
        { type: 'email', value: 'secret@example.com' },
      ]);
    });

    it('emits stable prefixes exactly once across the bounded carryover', async () => {
      const detector = new PIIDetector({
        model: new MockLanguageModelV1(),
        strategy: 'redact',
        redactionMethod: 'placeholder',
        detectionTypes: ['email'],
      });
      const state: Record<string, any> = {};
      const prefix = 'a'.repeat(140);
      const emitted: string[] = [];

      for (const [id, text] of [
        ['first', `${prefix} secret@`],
        ['second', 'example.com trailing'],
      ]) {
        const result = await detector.processOutputStream({
          part: { type: 'text-delta', payload: { id, text }, runId: id, from: ChunkFrom.AGENT },
          streamParts: [],
          state,
          abort: vi.fn() as any,
        });
        if (result?.type === 'text-delta') emitted.push(result.payload.text);
      }

      const flushed = await detector.processOutputStream({
        part: { type: 'step-finish' as any, payload: {}, runId: 'finish', from: ChunkFrom.AGENT },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      if (flushed?.type === 'text-delta') emitted.push(flushed.payload.text);

      expect(emitted.join('')).toBe(`${prefix} [EMAIL] trailing`);
    });

    it('pulls emission back when PII straddles the carryover boundary', async () => {
      const detector = new PIIDetector({
        model: new MockLanguageModelV1(),
        strategy: 'redact',
        redactionMethod: 'placeholder',
        detectionTypes: ['email'],
      });
      const state: Record<string, any> = {};
      const text = `${'a'.repeat(10)} secret@example.com ${'z'.repeat(114)}`;
      const emitted: string[] = [];
      const first = await detector.processOutputStream({
        part: { type: 'text-delta', payload: { id: 'first', text }, runId: 'first', from: ChunkFrom.AGENT },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      if (first?.type === 'text-delta') emitted.push(first.payload.text);
      const flushed = await detector.processOutputStream({
        part: { type: 'step-finish' as any, payload: {}, runId: 'finish', from: ChunkFrom.AGENT },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      if (flushed?.type === 'text-delta') emitted.push(flushed.payload.text);

      expect(first).toMatchObject({ type: 'text-delta', payload: { text: `${'a'.repeat(10)} ` } });
      expect(emitted.join('')).toBe(`${'a'.repeat(10)} [EMAIL] ${'z'.repeat(114)}`);
    });

    it('keeps mixed-mode sentence fragments in regex carryover', async () => {
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { promptTokens: 10, completionTokens: 20 },
          text: JSON.stringify(createMockPIIResult()),
        }),
      });
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
        redactionMethod: 'placeholder',
        detectionTypes: ['email', 'name'],
      });
      const state: Record<string, any> = {};

      expect(
        await detector.processOutputStream({
          part: {
            type: 'text-delta',
            payload: { id: 'first', text: 'Contact secret@example.' },
            runId: 'first',
            from: ChunkFrom.AGENT,
          },
          streamParts: [],
          state,
          abort: vi.fn() as any,
        }),
      ).toBeNull();
      expect(
        await detector.processOutputStream({
          part: { type: 'text-delta', payload: { id: 'second', text: 'com' }, runId: 'second', from: ChunkFrom.AGENT },
          streamParts: [],
          state,
          abort: vi.fn() as any,
        }),
      ).toBeNull();
      const flushed = await detector.processOutputStream({
        part: { type: 'step-finish' as any, payload: {}, runId: 'finish', from: ChunkFrom.AGENT },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      expect(flushed).toMatchObject({ type: 'text-delta', payload: { text: 'Contact [EMAIL]' } });
    });

    it('preserves regex carryover and replacement lengths across mixed-mode flushes', async () => {
      let llmCallCount = 0;
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          llmCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { promptTokens: 10, completionTokens: 20 },
            text: JSON.stringify(createMockPIIResult()),
          };
        },
      });
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
        redactionMethod: 'placeholder',
        detectionTypes: ['email', 'ip-address', 'name'],
        bufferSize: 5,
      });
      const state: Record<string, any> = {};
      const emitted: string[] = [];
      const emittedParts: any[] = [];

      for (const [id, text] of [
        ['first', `${'x'.repeat(128)} ip 1.1.1.1 secret@`],
        ['second', 'example.com'],
      ]) {
        const result = await detector.processOutputStream({
          part: { type: 'text-delta', payload: { id, text }, runId: id, from: ChunkFrom.AGENT },
          streamParts: [],
          state,
          abort: vi.fn() as any,
        });
        if (result?.type === 'text-delta') {
          emitted.push(result.payload.text);
          emittedParts.push(result);
        }
      }

      const flushed = await detector.processOutputStream({
        part: { type: 'step-finish' as any, payload: {}, runId: 'finish', from: ChunkFrom.AGENT },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      if (flushed?.type === 'text-delta') {
        emitted.push(flushed.payload.text);
        emittedParts.push(flushed);
      }

      expect(llmCallCount).toBe(3);
      expect(emitted.join('')).toBe(`${'x'.repeat(128)} ip [IP-ADDRESS] [EMAIL]`);
      expect(emittedParts[0]).toMatchObject({ payload: { id: 'first' }, runId: 'first' });
      expect(emittedParts[1]).toMatchObject({ payload: { id: 'first' }, runId: 'first' });
      expect(emittedParts[2]).toMatchObject({ payload: { id: 'first' }, runId: 'first' });
    });

    it('keeps text queued behind direct-call non-text parts', async () => {
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { promptTokens: 10, completionTokens: 20 },
          text: JSON.stringify(createMockPIIResult()),
        }),
      });
      const events: any[] = [];
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
        detectionTypes: ['email', 'name'],
        onDetection: event => void events.push(event),
      });
      const state: Record<string, any> = {};
      const finishOne = { type: 'step-finish' as any, payload: { step: 1 }, runId: 'one', from: ChunkFrom.AGENT };
      const finishTwo = { type: 'step-finish' as any, payload: { step: 2 }, runId: 'two', from: ChunkFrom.AGENT };

      await detector.processOutputStream({
        part: { type: 'text-delta', payload: { id: 'a', text: 'first' }, runId: 'a', from: ChunkFrom.AGENT },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      await detector.processOutputStream({ part: finishOne, streamParts: [], state, abort: vi.fn() as any });
      expect(
        await detector.processOutputStream({
          part: {
            type: 'text-delta',
            payload: { id: 'b', text: 'secret@example.com' },
            runId: 'b',
            from: ChunkFrom.AGENT,
          },
          streamParts: [],
          state,
          abort: vi.fn() as any,
        }),
      ).toEqual(finishOne);
      const flushed = await detector.processOutputStream({
        part: finishTwo,
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      expect(flushed).toMatchObject({ type: 'text-delta', payload: { text: 's****t@*******.com' } });
      expect(state._piiPendingNonText).toEqual([finishTwo]);
      expect(events.filter(event => event.detectionResult.detections?.length)).toHaveLength(1);
      expect(events.find(event => event.detectionResult.detections?.length)?.detectionResult.detections).toMatchObject([
        { type: 'email', value: 'secret@example.com' },
      ]);
    });

    it('should drain queued non-text parts in FIFO order', async () => {
      let _llmCallCount = 0;
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          _llmCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { promptTokens: 10, completionTokens: 20 },
            text: JSON.stringify(createMockPIIResult()),
          };
        },
      });
      const detector = new PIIDetector({ model, detectionTypes: ['email', 'name'], strategy: 'block' });
      const state: Record<string, any> = {};

      // Buffer some text first
      await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'text-0', text: 'Hello world' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      expect(state._piiBuffer).toBe('Hello world');

      // Non-text part triggers flush — gets queued
      const nonText1 = {
        type: 'step-finish' as any,
        payload: { stepId: 'step-1' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const flushed = await detector.processOutputStream({
        part: nonText1,
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      // Flushed buffer returned
      expect(flushed).not.toBeNull();
      // Non-text part queued
      expect(state._piiPendingNonText).toEqual([nonText1]);

      // Next text-delta should drain the queued non-text part
      const result = await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'text-1', text: 'more text' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });
      // Returns the queued non-text part
      expect(result).toEqual(nonText1);
      // Queue is drained
      expect(state._piiPendingNonText).toBeUndefined();
      // Text was re-buffered
      expect(state._piiBuffer).toBe('more text');
    });

    it('should use default bufferSize of 200 when not specified', async () => {
      let llmCallCount = 0;
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          llmCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { promptTokens: 10, completionTokens: 20 },
            text: JSON.stringify(createMockPIIResult()),
          };
        },
      });
      const detector = new PIIDetector({ model, detectionTypes: ['email', 'name'] });
      const state: Record<string, any> = {};

      // Send 100 chars — under default 200 threshold, no sentence boundary
      await detector.processOutputStream({
        part: {
          type: 'text-delta',
          payload: { id: 'text-0', text: 'A'.repeat(100) },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state,
        abort: vi.fn() as any,
      });

      // Should NOT have flushed; the bounded regex suffix remains raw until it is safe to redact.
      expect(llmCallCount).toBe(0);
      expect(state._piiBuffer).toBeUndefined();
      expect(state._piiRegexTail).toBe('A'.repeat(100));
    });
  });

  describe('processOutputResult', () => {
    it('should return empty messages array unchanged', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model });

      const messages: MastraDBMessage[] = [];
      const result = await detector.processOutputResult({ messages, abort: vi.fn() as any });
      expect(result).toEqual(messages);
    });

    it('should return messages without text content unchanged', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model });

      const messages: MastraDBMessage[] = [createTestMessage('Some reasoning', 'assistant', 'test-id1')];

      const result = await detector.processOutputResult({ messages, abort: vi.fn() as any });
      expect(result).toEqual(messages);
    });

    it('should detect and redact PII in output messages', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
          start: 12,
          end: 28,
          redacted_value: null,
        },
      ];
      const model = setupMockModel(createMockPIIResult(['email'], detections, 'My email is j***.d**@e******.com'));
      const detector = new PIIDetector({ model });

      const messages: MastraDBMessage[] = [createTestMessage('My email is test@example.com', 'assistant', 'test-id1')];

      const result = await detector.processOutputResult({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect((result[0].content.parts[0] as TextPart).text).toBe('My email is j***.d**@e******.com');
    });

    it('merges overlapping PII detections in output results', async () => {
      const detections: PIIDetection[] = [
        { type: 'email', value: 'abcdefghijkl', confidence: 1, start: 7, end: 19, redacted_value: null },
        { type: 'url', value: 'ijklmnop', confidence: 1, start: 15, end: 23, redacted_value: null },
      ];
      const model = setupMockModel(createMockPIIResult(['email', 'url'], detections, null));
      const detector = new PIIDetector({ model, strategy: 'redact', redactionMethod: 'placeholder' });
      const messages = [createTestMessage('before abcdefghijklmnop after', 'assistant')];

      const result = await detector.processOutputResult({ messages, abort: vi.fn() as any });

      expect((result[0].content.parts[0] as TextPart).text).toBe('before [EMAIL] after');
    });

    it('should block output when strategy is block and PII is detected', async () => {
      const model = setupMockModel(createMockPIIResult(['email']));
      const detector = new PIIDetector({ model, strategy: 'block' });

      const messages: MastraDBMessage[] = [createTestMessage('My email is test@example.com', 'assistant', 'test-id1')];

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('PII detected');
      });

      await expect(detector.processOutputResult({ messages, abort: mockAbort as any })).rejects.toThrow('PII detected');
      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('PII detected'));
    });

    it('should filter output messages when strategy is filter and PII is detected', async () => {
      const model = setupMockModel([
        createMockPIIResult(['email']), // PII for first message
        createMockPIIResult(), // No PII for second message
      ]);
      const detector = new PIIDetector({ model, strategy: 'filter' });

      const messages: MastraDBMessage[] = [
        createTestMessage('My email is test@example.com', 'assistant', 'test-id1'),
        createTestMessage('This is safe content', 'assistant', 'test-id2'),
      ];

      const result = await detector.processOutputResult({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect((result[0].content.parts[0] as TextPart).text).toBe('This is safe content');
    });

    it('should warn but allow content when strategy is warn and PII is detected', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const model = setupMockModel(createMockPIIResult(['email']));
      const detector = new PIIDetector({ model, strategy: 'warn' });

      const messages: MastraDBMessage[] = [createTestMessage('My email is test@example.com', 'assistant')];

      const result = await detector.processOutputResult({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PII detected'));

      consoleSpy.mockRestore();
    });

    it('should handle output detection failures gracefully', async () => {
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          throw new Error('Detection failed');
        },
      });
      const detector = new PIIDetector({ model });
      const messages: MastraDBMessage[] = [createTestMessage('My email is test@example.com', 'assistant')];

      const result = await detector.processOutputResult({ messages, abort: vi.fn() as any });
      expect(result).toEqual(messages); // Should return original messages on failure
    });
  });

  describe('structured output schema compatibility', () => {
    it('should not send number bounds to Anthropic in score or confidence schemas', async () => {
      const mockResult = createMockPIIResult();
      const mockModel = new MastraLanguageModelV2Mock({
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text: JSON.stringify(mockResult) }],
          warnings: [],
        }),
      });

      const detector = new PIIDetector({ model: mockModel });

      await detector.processInput({ messages: [createTestMessage('Hello world')], abort: vi.fn() as any });

      const responseFormat = mockModel.doGenerateCalls[0].responseFormat;
      expect(responseFormat?.type).toBe('json');
      const schema = responseFormat?.type === 'json' ? responseFormat.schema : undefined;
      const schemaJson = JSON.stringify(schema);
      expect(schemaJson).toContain('score');
      expect(schemaJson).toContain('confidence');
      expect(schemaJson).not.toContain('minimum');
      expect(schemaJson).not.toContain('maximum');
    });

    it('should reject scores outside the 0-1 range at runtime', async () => {
      const model = setupMockModel({
        categories: [{ type: 'email', score: 1.2 }],
        detections: null,
      });
      const detector = new PIIDetector({ model, strategy: 'warn', threshold: 1.1 });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await detector.processInput({
        messages: [createTestMessage('Hello world')],
        abort: vi.fn() as any,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[PIIDetector] Detection agent failed, allowing content:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should reject confidence values outside the 0-1 range at runtime', async () => {
      const model = setupMockModel({
        categories: null,
        detections: [{ type: 'email', value: 'test@example.com', confidence: -0.2, start: 0, end: 16 }],
      });
      const detector = new PIIDetector({ model, strategy: 'warn', threshold: 0 });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await detector.processInput({ messages: [createTestMessage('Hello world')], abort: vi.fn() as any });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[PIIDetector] Detection agent failed, allowing content:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('onDetection callback', () => {
    it('should report clean results with strategyApplied "none"', async () => {
      const model = setupMockModel(createMockPIIResult());
      const events: any[] = [];
      const detector = new PIIDetector({ model, onDetection: e => void events.push(e) });

      await detector.processInput({ messages: [createTestMessage('Hello world')], abort: vi.fn() as any });

      expect(events).toHaveLength(1);
      expect(events[0].input).toBe('Hello world');
      expect(events[0].flagged).toBe(false);
      expect(events[0].strategyApplied).toBe('none');
      expect(events[0].detectionResult.categories).toBeNull();
    });

    it('should report flagged results with the configured strategy', async () => {
      const detections: PIIDetection[] = [
        { type: 'email', value: 'test@example.com', confidence: 0.9, start: 0, end: 16, redacted_value: null },
      ];
      const model = setupMockModel(createMockPIIResult(['email'], detections, '***@***.com'));
      const events: any[] = [];
      const detector = new PIIDetector({ model, strategy: 'redact', onDetection: e => void events.push(e) });

      await detector.processInput({ messages: [createTestMessage('test@example.com')], abort: vi.fn() as any });

      expect(events).toHaveLength(1);
      expect(events[0].flagged).toBe(true);
      expect(events[0].strategyApplied).toBe('redact');
      expect(events[0].detectionResult.detections).toEqual(detections);
    });

    it('should fire before aborting under the block strategy', async () => {
      const model = setupMockModel(
        createMockPIIResult(
          ['email'],
          [{ type: 'email', value: 'test@example.com', confidence: 0.9, start: 0, end: 16 }],
        ),
      );
      const events: any[] = [];
      const detector = new PIIDetector({ model, strategy: 'block', onDetection: e => void events.push(e) });
      const abort = vi.fn().mockImplementation((reason?: string) => {
        throw new TripWire(reason ?? 'aborted');
      }) as any;

      await expect(detector.processInput({ messages: [createTestMessage('test@example.com')], abort })).rejects.toThrow(
        TripWire,
      );

      expect(events).toHaveLength(1);
      expect(events[0].strategyApplied).toBe('block');
    });

    it('should report regex detections found during streaming', async () => {
      const model = setupMockModel(createMockPIIResult());
      const events: any[] = [];
      const detector = new PIIDetector({
        model,
        detectionTypes: REGEX_ONLY_TYPES,
        onDetection: e => void events.push(e),
      });

      await detector.processOutputStream({
        part: {
          type: 'text-delta' as const,
          payload: { id: 'test-id', text: 'Reach me at test@example.com' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        streamParts: [],
        state: {},
        abort: vi.fn() as any,
      });

      expect(events).toHaveLength(1);
      expect(events[0].flagged).toBe(true);
      expect(events[0].detectionResult.detections?.[0].type).toBe('email');
    });

    it('should not let callback errors break processing', async () => {
      const model = setupMockModel(createMockPIIResult());
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const detector = new PIIDetector({
        model,
        onDetection: () => {
          throw new Error('boom');
        },
      });

      const result = await detector.processInput({
        messages: [createTestMessage('Hello world')],
        abort: vi.fn() as any,
      });

      expect(result).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith('[PIIDetector] onDetection callback failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
