import { MockLanguageModelV1 } from 'ai/test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraMessageV2 } from '../../message-list';
import { TripWire } from '../../trip-wire';
import type { PIIDetectionResult, PIIDetection } from './pii-detector';
import { PIIDetector } from './pii-detector';

function createTestMessage(text: string, role: 'user' | 'assistant' = 'user', id = 'test-id'): MastraMessageV2 {
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
  redactedContent?: string,
): PIIDetectionResult {
  const result: PIIDetectionResult = {};

  // Only include categories if there are detected PII types
  if (piiTypes.length > 0) {
    result.categories = piiTypes.reduce(
      (scores, type) => {
        scores[type] = 0.8; // High confidence score for detected types
        return scores;
      },
      {} as Record<string, number>,
    );
  }

  // Only include detections if provided
  if (detections.length > 0) {
    result.detections = detections;
  }

  // Only include redacted content if provided
  if (redactedContent) {
    result.redacted_content = redactedContent;
  }

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

      const result = await detector.process({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
    });

    it('should handle empty messages array', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model });

      const result = await detector.process({ messages: [], abort: vi.fn() as any });

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

      const result = await detector.process({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
    });

    it('should handle messages with empty text content', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('')];

      const result = await detector.process({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
    });
  });

  describe('PII detection with default strategy (redact)', () => {
    it('should detect and redact email addresses', async () => {
      const detections = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
          start: 12,
          end: 28,
        },
      ];
      const model = setupMockModel(createMockPIIResult(['email'], detections));
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('My email is test@example.com')];

      const result = await detector.process({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'My email is t**t@*******.com',
      });
    });

    it('should detect and redact phone numbers', async () => {
      const detections = [
        {
          type: 'phone',
          value: '(555) 123-4567',
          confidence: 0.85,
          start: 19,
          end: 33,
        },
      ];
      const model = setupMockModel(createMockPIIResult(['phone'], detections));
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('My phone number is (555) 123-4567')];

      const result = await detector.process({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'My phone number is (XXX) XXX-4567',
      });
    });

    it('should detect and redact credit card numbers', async () => {
      const detections = [
        {
          type: 'credit-card',
          value: '4111-1111-1111-1111',
          confidence: 0.95,
          start: 8,
          end: 27,
        },
      ];
      const model = setupMockModel(createMockPIIResult(['credit-card'], detections));
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('Card: 4111-1111-1111-1111')];

      const result = await detector.process({ messages, abort: vi.fn() as any });

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

      const result = await detector.process({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
    });

    it('should detect multiple PII types', async () => {
      const detections = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
          start: 12,
          end: 28,
        },
        {
          type: 'api-key',
          value: 'sk_test_123456789',
          confidence: 0.95,
          start: 36,
          end: 51,
        },
      ];
      const model = setupMockModel(createMockPIIResult(['email', 'api-key'], detections));
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('My email is test@example.com and key sk_test_123456789')];

      const result = await detector.process({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'My email is t**t@*******.com and keys***************9789',
      });
    });

    it('should handle multiple messages', async () => {
      const detections = [
        {
          type: 'phone',
          value: '555-1234',
          confidence: 0.8,
          start: 19,
          end: 27,
        },
      ];
      const model = setupMockModel([
        createMockPIIResult(), // No PII for first message
        createMockPIIResult(['phone'], detections), // PII for second message
      ]);
      const detector = new PIIDetector({ model });
      const messages = [createTestMessage('Hello world'), createTestMessage('My phone number is 555-1234')];

      const result = await detector.process({ messages, abort: vi.fn() as any });

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

      await expect(detector.process({ messages, abort: mockAbort as any })).rejects.toThrow('PII detected');

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('PII detected'));
    });

    it('should process all messages if no PII is detected', async () => {
      const model = setupMockModel(createMockPIIResult(['email']));
      const detector = new PIIDetector({ model, strategy: 'block' });
      const messages = [createTestMessage('Hello world')];

      const result = await detector.process({ messages, abort: vi.fn() as any });

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

      const result = await detector.process({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(0);
    });

    it('should return empty array if all messages contain PII', async () => {
      const model = setupMockModel(createMockPIIResult(['ssn'])); // No redacted_content
      const detector = new PIIDetector({ model, strategy: 'filter' });
      const messages = [createTestMessage('SSN: 123-45-6789'), createTestMessage('Another SSN: 987-65-4321')];

      const result = await detector.process({ messages, abort: vi.fn() as any });

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

      const result = await detector.process({ messages, abort: vi.fn() as any });

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

      const result = await detector.process({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PII detected'));

      consoleSpy.mockRestore();
    });
  });

  describe('strategy: redact', () => {
    it('should use provided redacted content when available', async () => {
      const detections = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
          start: 12,
          end: 28,
        },
      ];
      const redactedContent = 'My email is [EMAIL]';
      const model = setupMockModel(createMockPIIResult(['email'], detections, redactedContent));
      const detector = new PIIDetector({ model, strategy: 'redact' });
      const messages = [createTestMessage('My email is test@example.com')];

      const result = await detector.process({ messages, abort: vi.fn() as any });

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

      const result = await detector.process({ messages, abort: vi.fn() as any });

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

      const result = await detector.process({ messages, abort: vi.fn() as any });

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
      if (mockResult.categories) {
        mockResult.categories.email = 0.7; // Above threshold (0.6)
      }

      const model = setupMockModel(mockResult);
      const detector = new PIIDetector({ model, threshold: 0.6, strategy: 'block' });
      const messages = [createTestMessage('test@example.com')];

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('PII detected');
      });

      await expect(detector.process({ messages, abort: mockAbort as any })).rejects.toThrow();
    });

    it('should not trigger when below threshold', async () => {
      const mockResult = createMockPIIResult(['email']);
      if (mockResult.categories) {
        mockResult.categories.email = 0.3; // Below threshold (0.6)
      }

      const model = setupMockModel(mockResult);
      const detector = new PIIDetector({ model, threshold: 0.6 });
      const messages = [createTestMessage('test@example.com')];

      const result = await detector.process({ messages, abort: vi.fn() as any });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(messages[0]);
    });
  });

  describe('custom detection types', () => {
    it('should work with custom PII types', async () => {
      const mockResult = {
        categories: { 'employee-id': 0.9, 'customer-id': 0.1 },
        detections: [
          {
            type: 'employee-id',
            value: 'EMP-12345',
            confidence: 0.9,
            start: 0,
            end: 9,
          },
        ],
        reason: 'Detected employee ID',
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
        await detector.process({ messages, abort: mockAbort as any });
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

      const message: MastraMessageV2 = {
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

      await detector.process({ messages: [message], abort: mockAbort as any });

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

      const message: MastraMessageV2 = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Call me at ' }],
          content: '555-1234',
        },
        createdAt: new Date(),
      };

      await detector.process({ messages: [message], abort: mockAbort as any });

      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should skip messages with no text content', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({
        model,
      });

      const mockAbort = vi.fn();

      const message: MastraMessageV2 = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'step-start' }],
        },
        createdAt: new Date(),
      };

      const result = await detector.process({ messages: [message], abort: mockAbort as any });

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
      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toEqual(messages); // Should allow content through
      expect(mockAbort).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PIIDetector] Detection agent failed'),
        expect.anything(),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle empty message array', async () => {
      const model = setupMockModel(createMockPIIResult());
      const detector = new PIIDetector({
        model,
      });

      const mockAbort = vi.fn();
      const result = await detector.process({ messages: [], abort: mockAbort as any });

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
        await detector.process({ messages: [invalidMessage], abort: mockAbort as any });
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
      await detector.process({ messages, abort: mockAbort as any });

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

      expect(detector.name).toBe('pii-detector');
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
      const result = await detector.process({ messages, abort: mockAbort as any });

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

      const result = await detector.process({ messages, abort: mockAbort as any });

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
        await detector.process({ messages, abort: mockAbort as any });
      }).rejects.toThrow('Multiple PII blocked');

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('email, phone, credit-card'));
    });
  });
});
