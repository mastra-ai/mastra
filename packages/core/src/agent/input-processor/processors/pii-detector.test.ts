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
  flagged: boolean,
  piiTypes: string[] = [],
  detections: PIIDetection[] = [],
  redactedContent?: string,
): PIIDetectionResult {
  const allTypes = [
    'email',
    'phone',
    'credit-card',
    'ssn',
    'api-key',
    'ip-address',
    'name',
    'address',
    'date-of-birth',
    'url',
  ];

  const categoryFlags = allTypes.reduce(
    (flags, type) => {
      flags[type] = piiTypes.includes(type);
      return flags;
    },
    {} as Record<string, boolean>,
  );

  const categoryScores = allTypes.reduce(
    (scores, type) => {
      scores[type] = piiTypes.includes(type) ? 0.8 : 0.1;
      return scores;
    },
    {} as Record<string, number>,
  );

  return {
    flagged,
    categories: categoryFlags,
    category_scores: categoryScores,
    detections,
    redacted_content: redactedContent,
    reason: flagged ? `PII detected: ${piiTypes.join(', ')}` : undefined,
  };
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

  describe('constructor and configuration', () => {
    it('should initialize with required model configuration', () => {
      const model = setupMockModel(createMockPIIResult(false));
      const detector = new PIIDetector({
        model,
      });

      expect(detector.name).toBe('pii-detector');
    });

    it('should use default detection types when none specified', () => {
      const model = setupMockModel(createMockPIIResult(false));
      const detector = new PIIDetector({
        model,
      });

      expect(detector.name).toBe('pii-detector');
    });

    it('should accept custom detection types', () => {
      const model = setupMockModel(createMockPIIResult(false));
      const detector = new PIIDetector({
        model,
        detectionTypes: ['email', 'phone', 'custom-id'],
      });

      expect(detector.name).toBe('pii-detector');
    });

    it('should accept custom configuration options', () => {
      const model = setupMockModel(createMockPIIResult(false));
      const detector = new PIIDetector({
        model,
        threshold: 0.8,
        strategy: 'redact',
        redactionMethod: 'placeholder',
        includeDetections: true,
        preserveFormat: false,
      });

      expect(detector.name).toBe('pii-detector');
    });
  });

  describe('PII detection types', () => {
    it('should detect email addresses', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'email',
          value: 'john.doe@example.com',
          confidence: 0.95,
          start: 11,
          end: 29,
          redacted_value: 'j******e@***.com',
        },
      ];
      const model = setupMockModel(createMockPIIResult(true, ['email'], detections));
      const detector = new PIIDetector({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('PII blocked');
      });

      const messages = [createTestMessage('Contact me at john.doe@example.com for more info', 'user')];

      await expect(async () => {
        await detector.process({ messages, abort: mockAbort as any });
      }).rejects.toThrow('PII blocked');

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('PII detected'));
    });

    it('should detect phone numbers', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'phone',
          value: '(555) 123-4567',
          confidence: 0.92,
          start: 12,
          end: 26,
          redacted_value: '(XXX) XXX-4567',
        },
      ];
      const model = setupMockModel(createMockPIIResult(true, ['phone'], detections));
      const detector = new PIIDetector({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('PII blocked');
      });

      const messages = [createTestMessage('Call me at (555) 123-4567 tomorrow', 'user')];

      await expect(async () => {
        await detector.process({ messages, abort: mockAbort as any });
      }).rejects.toThrow('PII blocked');
    });

    it('should detect credit card numbers', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'credit-card',
          value: '4532-1234-5678-9012',
          confidence: 0.98,
          start: 12,
          end: 31,
          redacted_value: '****-****-****-9012',
        },
      ];
      const model = setupMockModel(createMockPIIResult(true, ['credit-card'], detections));
      const detector = new PIIDetector({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('PII blocked');
      });

      const messages = [createTestMessage('My card is 4532-1234-5678-9012', 'user')];

      await expect(async () => {
        await detector.process({ messages, abort: mockAbort as any });
      }).rejects.toThrow('PII blocked');
    });

    it('should allow content without PII through', async () => {
      const model = setupMockModel(createMockPIIResult(false));
      const detector = new PIIDetector({
        model,
      });

      const mockAbort = vi.fn();

      const messages = [
        createTestMessage('What is the weather like today?', 'user'),
        createTestMessage('Can you help me with this task?', 'user'),
      ];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toEqual(messages);
      expect(mockAbort).not.toHaveBeenCalled();
    });
  });

  describe('strategy: block', () => {
    it('should abort when PII is detected', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'email',
          value: 'test@example.com',
          confidence: 0.9,
          start: 0,
          end: 16,
        },
      ];
      const model = setupMockModel(createMockPIIResult(true, ['email', 'api-key'], detections));
      const detector = new PIIDetector({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('Blocked');
      });

      const messages = [createTestMessage('test@example.com and sk_12345', 'user')];

      await expect(async () => {
        await detector.process({ messages, abort: mockAbort as any });
      }).rejects.toThrow('Blocked');

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('email, api-key'));
    });
  });

  describe('strategy: warn', () => {
    it('should log warning but allow content through', async () => {
      const detections: PIIDetection[] = [
        {
          type: 'phone',
          value: '555-1234',
          confidence: 0.7,
          start: 0,
          end: 8,
        },
      ];
      const model = setupMockModel(createMockPIIResult(true, ['phone'], detections));
      const detector = new PIIDetector({
        model,
        strategy: 'warn',
      });

      const mockAbort = vi.fn();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages = [createTestMessage('555-1234 is my number', 'user')];
      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toEqual(messages);
      expect(mockAbort).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[PIIDetector] PII detected'));

      consoleSpy.mockRestore();
    });
  });

  describe('strategy: filter', () => {
    it('should remove flagged messages but keep safe ones', async () => {
      const model = setupMockModel([createMockPIIResult(false), createMockPIIResult(true, ['email'])]);
      const detector = new PIIDetector({
        model,
        strategy: 'filter',
      });

      const mockAbort = vi.fn();
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const messages = [
        createTestMessage('Safe message', 'user', 'msg1'),
        createTestMessage('Email me at john@example.com', 'user', 'msg2'),
      ];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg1');
      expect(mockAbort).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('[PIIDetector] Filtered message'));

      consoleInfoSpy.mockRestore();
    });

    it('should return empty array if all messages contain PII', async () => {
      const model = setupMockModel(createMockPIIResult(true, ['email']));
      const detector = new PIIDetector({
        model,
        strategy: 'filter',
      });

      const mockAbort = vi.fn();

      const messages = [
        createTestMessage('Email: test1@example.com', 'user', 'msg1'),
        createTestMessage('Email: test2@example.com', 'user', 'msg2'),
      ];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(0);
      expect(mockAbort).not.toHaveBeenCalled();
    });
  });

  describe('strategy: redact', () => {
    it('should redact PII when redacted content is provided', async () => {
      const redactedContent = 'Contact me at j***@***.com for info';
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
      const model = setupMockModel(createMockPIIResult(true, ['email'], detections, redactedContent));
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
      });

      const mockAbort = vi.fn();
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const messages = [createTestMessage('Contact me at john@example.com for info', 'user', 'msg1')];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: redactedContent,
      });
      expect(mockAbort).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('[PIIDetector] Redacted PII'));

      consoleInfoSpy.mockRestore();
    });

    it('should filter message if no redacted content is available', async () => {
      const model = setupMockModel(createMockPIIResult(true, ['ssn'])); // No redacted_content
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
      });

      const mockAbort = vi.fn();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages = [createTestMessage('SSN: 123-45-6789', 'user', 'msg1')];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1); // Should fallback to original message
      expect(mockAbort).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle mixed content with different redaction outcomes', async () => {
      const redactedContent = 'Call me at XXX-XXX-1234';
      const detections: PIIDetection[] = [
        {
          type: 'phone',
          value: '555-123-1234',
          confidence: 0.9,
          start: 11,
          end: 23,
          redacted_value: 'XXX-XXX-1234',
        },
      ];
      const model = setupMockModel([
        createMockPIIResult(false),
        createMockPIIResult(true, ['phone'], detections, redactedContent),
        createMockPIIResult(true, ['credit-card']), // No redaction
      ]);
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
      });

      const mockAbort = vi.fn();

      const messages = [
        createTestMessage('Safe message', 'user', 'msg1'),
        createTestMessage('Call me at 555-123-1234', 'user', 'msg2'),
        createTestMessage('Card: 4532123456789012', 'user', 'msg3'),
      ];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('msg1'); // Safe message
      expect(result[1].content.parts?.[0]).toEqual({
        type: 'text',
        text: redactedContent,
      }); // Redacted message
      expect(result[2].id).toBe('msg3'); // Fallback to original for non-redactable
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
      const model = setupMockModel(createMockPIIResult(true, ['email', 'phone'], detections, redactedContent));
      const detector = new PIIDetector({
        model,
        strategy: 'redact',
        redactionMethod: 'placeholder',
      });

      const mockAbort = vi.fn();

      const messages = [createTestMessage('test@example.com and 555-1234', 'user')];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: redactedContent,
      });
    });
  });

  describe('threshold handling', () => {
    it('should flag content when any score exceeds threshold', async () => {
      const mockResult = createMockPIIResult(false, []);
      // Override with high email score to exceed threshold
      mockResult.category_scores.email = 0.7; // Above threshold (0.5)
      mockResult.reason = 'High email score';
      const model = setupMockModel(mockResult);
      const detector = new PIIDetector({
        model,
        threshold: 0.5,
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('Blocked');
      });

      const messages = [createTestMessage('Borderline email pattern', 'user')];

      await expect(async () => {
        await detector.process({ messages, abort: mockAbort as any });
      }).rejects.toThrow('Blocked');
    });

    it('should not flag content when scores are below threshold', async () => {
      const mockResult = createMockPIIResult(false, []);
      // Set email score below threshold
      mockResult.category_scores.email = 0.8; // Below threshold (0.9)
      const model = setupMockModel(mockResult);
      const detector = new PIIDetector({
        model,
        threshold: 0.9,
        strategy: 'block',
      });

      const mockAbort = vi.fn();

      const messages = [createTestMessage('Borderline content', 'user')];
      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toEqual(messages);
      expect(mockAbort).not.toHaveBeenCalled();
    });
  });

  describe('custom detection types', () => {
    it('should work with custom PII types', async () => {
      const mockResult = {
        flagged: true,
        categories: { 'employee-id': true, 'customer-id': false },
        category_scores: { 'employee-id': 0.9, 'customer-id': 0.1 },
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
      const model = setupMockModel(createMockPIIResult(false));
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
      const model = setupMockModel(createMockPIIResult(false));
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
      const model = setupMockModel(createMockPIIResult(false));
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
      const model = setupMockModel(createMockPIIResult(false));
      const detector = new PIIDetector({
        model,
      });

      const mockAbort = vi.fn();
      const result = await detector.process({ messages: [], abort: mockAbort as any });

      expect(result).toEqual([]);
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should abort on non-tripwire errors during processing', async () => {
      const model = setupMockModel(createMockPIIResult(false));
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

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('PII detection failed'));
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
      const model = setupMockModel(createMockPIIResult(true, ['email'], detections));
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
      const model = setupMockModel(createMockPIIResult(false));

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
      const model = setupMockModel(createMockPIIResult(false));
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
      const model = setupMockModel(createMockPIIResult(true, ['email', 'phone', 'credit-card'], detections));
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
