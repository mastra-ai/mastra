import { MockLanguageModelV1 } from 'ai/test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraMessageV2 } from '../../message-list';
import { TripWire } from '../../trip-wire';
import type { LanguageDetectionResult, TranslationResult } from './language-detector';
import { LanguageDetector } from './language-detector';

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

function createMockLanguageResult(
  language: string,
  isoCode: string,
  confidence: number,
  isTarget: boolean,
  translation?: TranslationResult,
): LanguageDetectionResult {
  // For target languages, return empty object (minimal tokens)
  if (isTarget) {
    return {};
  }

  return {
    iso_code: isoCode,
    confidence,
    ...(translation && { translated_text: translation.translated_text }),
  };
}

function setupMockModel(result: LanguageDetectionResult | LanguageDetectionResult[]): MockLanguageModelV1 {
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
        text: `${JSON.stringify(currentResult)}`,
      };
    },
  });
}

describe('LanguageDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor and configuration', () => {
    it('should initialize with required model configuration', () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.95, true));
      const detector = new LanguageDetector({
        model,
      });

      expect(detector.name).toBe('language-detector');
    });

    it('should use default target languages when none specified', () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.95, true));
      const detector = new LanguageDetector({
        model,
      });

      expect(detector.name).toBe('language-detector');
    });

    it('should accept custom target languages', () => {
      const model = setupMockModel(createMockLanguageResult('Spanish', 'es', 0.95, true));
      const detector = new LanguageDetector({
        model,
        targetLanguages: ['Spanish', 'French', 'German'],
      });

      expect(detector.name).toBe('language-detector');
    });

    it('should accept custom configuration options', () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.95, true));
      const detector = new LanguageDetector({
        model,
        targetLanguages: ['English'],
        threshold: 0.8,
        strategy: 'translate',
        preserveOriginal: false,
        minTextLength: 20,
        includeDetectionDetails: true,
        translationQuality: 'speed',
      });

      expect(detector.name).toBe('language-detector');
    });
  });

  describe('language detection', () => {
    it('should detect English content as target language', async () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.95, true));
      const detector = new LanguageDetector({
        model,
        targetLanguages: ['English'],
        includeDetectionDetails: true,
      });

      const mockAbort = vi.fn();
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const messages = [createTestMessage('Hello, how are you today?', 'user')];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect((result[0].content.metadata as any)?.language_detection).toEqual({
        detected_language: 'English',
        iso_code: 'en',
        confidence: 0.95,
        is_target_language: true,
        target_languages: ['English'],
      });
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LanguageDetector] Content in target language'),
      );

      consoleInfoSpy.mockRestore();
    });

    it('should detect Spanish content as non-target language', async () => {
      const model = setupMockModel(createMockLanguageResult('Spanish', 'es', 0.92, false));
      const detector = new LanguageDetector({
        model,
        targetLanguages: ['English'],
        strategy: 'detect',
      });

      const mockAbort = vi.fn();
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const messages = [createTestMessage('Hola, ¿cómo estás?', 'user')];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect((result[0].content.metadata as any)?.language_detection).toEqual({
        detected_language: 'Spanish',
        iso_code: 'es',
        confidence: 0.92,
        is_target_language: false,
        target_languages: ['English'],
      });
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LanguageDetector] Language detected: Spanish'),
      );

      consoleInfoSpy.mockRestore();
    });

    it('should detect multiple languages correctly', async () => {
      const model = setupMockModel([
        createMockLanguageResult('English', 'en', 0.95, true),
        createMockLanguageResult('French', 'fr', 0.88, false),
        createMockLanguageResult('Japanese', 'ja', 0.98, false),
      ]);
      const detector = new LanguageDetector({
        model,
        targetLanguages: ['English'],
      });

      const mockAbort = vi.fn();

      const messages = [
        createTestMessage('Hello, how are you?', 'user', 'msg1'),
        createTestMessage('Bonjour, comment allez-vous?', 'user', 'msg2'),
        createTestMessage('こんにちは、元気ですか？', 'user', 'msg3'),
      ];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(3);
      expect((result[0].content.metadata as any)?.language_detection?.detected_language).toBe('English');
      expect((result[1] as any).content.metadata?.language_detection?.detected_language).toBe('French');
      expect((result[2] as any).content.metadata?.language_detection?.detected_language).toBe('Japanese');
    });
  });

  describe('strategy: detect', () => {
    it('should only detect language without translation', async () => {
      const model = setupMockModel(createMockLanguageResult('German', 'de', 0.89, false));
      const detector = new LanguageDetector({
        model,
        strategy: 'detect',
      });

      const mockAbort = vi.fn();

      const messages = [createTestMessage('Guten Tag, wie geht es Ihnen?', 'user')];
      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'Guten Tag, wie geht es Ihnen?', // Original text preserved
      });
      expect((result[0].content.metadata as any)?.language_detection?.detected_language).toBe('German');
    });
  });

  describe('strategy: warn', () => {
    it('should log warning for non-target language but keep content', async () => {
      const model = setupMockModel(createMockLanguageResult('Italian', 'it', 0.87, false));
      const detector = new LanguageDetector({
        model,
        strategy: 'warn',
      });

      const mockAbort = vi.fn();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages = [createTestMessage('Ciao, come stai?', 'user')];
      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'Ciao, come stai?',
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[LanguageDetector] Non-target language'));

      consoleWarnSpy.mockRestore();
    });
  });

  describe('strategy: block', () => {
    it('should abort when non-target language is detected', async () => {
      const model = setupMockModel(createMockLanguageResult('Portuguese', 'pt', 0.91, false));
      const detector = new LanguageDetector({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('Language blocked');
      });

      const messages = [createTestMessage('Olá, como você está?', 'user')];

      await expect(async () => {
        await detector.process({ messages, abort: mockAbort as any });
      }).rejects.toThrow('Language blocked');

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('Non-target language detected'));
    });

    it('should allow target language through when blocking is enabled', async () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.96, true));
      const detector = new LanguageDetector({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn();

      const messages = [createTestMessage('Hello, this is in English', 'user')];
      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect(mockAbort).not.toHaveBeenCalled();
    });
  });

  describe('strategy: translate', () => {
    it('should translate non-target language to target language', async () => {
      const translation: TranslationResult = {
        original_text: 'Bonjour le monde',
        original_language: 'French',
        translated_text: 'Hello world',
        target_language: 'English',
        confidence: 0.93,
      };
      const model = setupMockModel(createMockLanguageResult('French', 'fr', 0.91, false, translation));
      const detector = new LanguageDetector({
        model,
        strategy: 'translate',
        preserveOriginal: true,
      });

      const mockAbort = vi.fn();
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const messages = [createTestMessage('Bonjour le monde', 'user', 'msg1')];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'Hello world',
      });
      expect((result[0].content.metadata as any)?.language_detection?.translation).toEqual({
        original_language: 'French',
        target_language: 'English',
        translation_confidence: 0.91,
      });
      expect((result[0].content.metadata as any)?.language_detection?.original_content).toBe('Bonjour le monde');
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('[LanguageDetector] Translated from French'));

      consoleInfoSpy.mockRestore();
    });

    it('should keep original when translation is not available', async () => {
      const model = setupMockModel(createMockLanguageResult('Russian', 'ru', 0.85, false)); // No translation
      const detector = new LanguageDetector({
        model,
        strategy: 'translate',
      });

      const mockAbort = vi.fn();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages = [createTestMessage('Привет, как дела?', 'user')];
      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts?.[0]).toEqual({
        type: 'text',
        text: 'Привет, как дела?',
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LanguageDetector] No translation available'),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle mixed content with some translations', async () => {
      const translation: TranslationResult = {
        original_text: 'Gracias por su ayuda',
        original_language: 'Spanish',
        translated_text: 'Thank you for your help',
        target_language: 'English',
        confidence: 0.95,
      };
      const model = setupMockModel([
        createMockLanguageResult('English', 'en', 0.97, true),
        createMockLanguageResult('Spanish', 'es', 0.93, false, translation),
        createMockLanguageResult('Chinese', 'zh', 0.89, false), // No translation
      ]);
      const detector = new LanguageDetector({
        model,
        strategy: 'translate',
      });

      const mockAbort = vi.fn();

      const messages = [
        createTestMessage('Hello there', 'user', 'msg1'),
        createTestMessage('Gracias por su ayuda', 'user', 'msg2'),
        createTestMessage('你好', 'user', 'msg3'),
      ];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(3);
      expect((result[0].content.parts?.[0] as any)?.text).toBe('Hello there'); // Original English
      expect((result[1].content.parts?.[0] as any)?.text).toBe('Thank you for your help'); // Translated
      expect((result[2].content.parts?.[0] as any)?.text).toBe('你好'); // Original Chinese (no translation)
    });
  });

  describe('threshold handling', () => {
    it('should skip processing when confidence is below threshold', async () => {
      const model = setupMockModel(createMockLanguageResult('Chinese', 'zh', 0.89, false)); // Below threshold (0.89 < 0.95)
      const detector = new LanguageDetector({
        model,
        threshold: 0.95, // High threshold to ensure processing is skipped
      });

      const mockAbort = vi.fn();

      const messages = [createTestMessage('Mixed lang text 123', 'user')];
      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect(result[0].content).toEqual(messages[0].content); // Content should be unchanged
      expect((result[0].content.metadata as any)?.language_detection).toBeUndefined(); // No metadata should be added
    });

    it('should process when confidence meets threshold', async () => {
      const model = setupMockModel(createMockLanguageResult('Swedish', 'sv', 0.75, false)); // Above threshold
      const detector = new LanguageDetector({
        model,
        threshold: 0.7,
      });

      const mockAbort = vi.fn();

      const messages = [createTestMessage('Hej, hur mår du?', 'user')];
      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect((result[0].content.metadata as any)?.language_detection?.detected_language).toBe('Swedish');
    });
  });

  describe('content filtering', () => {
    it('should skip short text below minimum length', async () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.95, true));
      const detector = new LanguageDetector({
        model,
        minTextLength: 15,
      });

      const mockAbort = vi.fn();
      const messages = [createTestMessage('Hi', 'user')]; // Only 2 characters

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      // Model should not have been called due to text length
      expect((result[0].content.metadata as any)?.language_detection).toBeUndefined();
    });

    it('should process text that meets minimum length', async () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.92, true));
      const detector = new LanguageDetector({
        model,
        minTextLength: 10,
      });

      const mockAbort = vi.fn();

      const messages = [createTestMessage('Hello there friend', 'user')]; // 18 characters

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect((result[0].content.metadata as any)?.language_detection?.detected_language).toBe('English');
    });
  });

  describe('content extraction', () => {
    it('should extract text from parts array', async () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.94, true));
      const detector = new LanguageDetector({
        model,
      });

      const mockAbort = vi.fn();

      const message: MastraMessageV2 = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello ' }, { type: 'step-start' }, { type: 'text', text: 'world!' }],
        },
        createdAt: new Date(),
      };

      await detector.process({ messages: [message], abort: mockAbort as any });

      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should extract text from content field', async () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.94, true));
      const detector = new LanguageDetector({
        model,
      });

      const mockAbort = vi.fn();

      const message: MastraMessageV2 = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello ' }],
          content: 'legacy content',
        },
        createdAt: new Date(),
      };

      await detector.process({ messages: [message], abort: mockAbort as any });

      expect(mockAbort).not.toHaveBeenCalled();
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
      const detector = new LanguageDetector({
        model,
        targetLanguages: ['Spanish'],
        includeDetectionDetails: true,
        threshold: 0.4, // Low threshold to ensure processing
      });

      const mockAbort = vi.fn();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const messages = [createTestMessage('Some text content', 'user')];
      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect((result[0].content.metadata as any)?.language_detection?.detected_language).toBe('Spanish'); // Should assume target
      expect((result[0].content.metadata as any)?.language_detection?.is_target_language).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LanguageDetector] Detection agent failed'),
        expect.anything(),
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LanguageDetector] Content in target language'),
      );

      consoleWarnSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });

    it('should handle empty message array', async () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.95, true));
      const detector = new LanguageDetector({
        model,
      });

      const mockAbort = vi.fn();
      const result = await detector.process({ messages: [], abort: mockAbort as any });

      expect(result).toEqual([]);
    });

    it('should abort on non-tripwire errors during processing', async () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.95, true));
      const detector = new LanguageDetector({
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

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('Language detection failed'));
    });
  });

  describe('configuration options', () => {
    it('should respect preserveOriginal setting', async () => {
      const translation: TranslationResult = {
        original_text: 'Hola mundo',
        original_language: 'Spanish',
        translated_text: 'Hello world',
        target_language: 'English',
        confidence: 0.95,
      };
      const model = setupMockModel(createMockLanguageResult('Spanish', 'es', 0.91, false, translation));
      const detector = new LanguageDetector({
        model,
        strategy: 'translate',
        preserveOriginal: false,
      });

      const mockAbort = vi.fn();

      const messages = [createTestMessage('Hola mundo', 'user')];
      const result = await detector.process({ messages, abort: mockAbort as any });

      expect((result[0].content.metadata as any)?.language_detection?.original_content).toBeUndefined();
    });

    it('should use custom target languages correctly', async () => {
      const model = setupMockModel(createMockLanguageResult('French', 'fr', 0.93, true));
      const detector = new LanguageDetector({
        model,
        targetLanguages: ['French', 'German'],
      });

      const mockAbort = vi.fn();

      const messages = [createTestMessage('Bonjour mes amis', 'user')];
      const result = await detector.process({ messages, abort: mockAbort as any });

      expect((result[0].content.metadata as any)?.language_detection?.target_languages).toEqual(['French', 'German']);
      expect((result[0].content.metadata as any)?.language_detection?.is_target_language).toBe(true);
    });

    it('should use custom instructions when provided', () => {
      const customInstructions = 'Custom language detection instructions for testing';
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.95, true));

      const detector = new LanguageDetector({
        model,
        instructions: customInstructions,
      });

      expect(detector.name).toBe('language-detector');
    });
  });

  describe('translation quality settings', () => {
    it('should pass translation quality to agent prompt', async () => {
      const model = setupMockModel(createMockLanguageResult('French', 'fr', 0.9, false));
      const detector = new LanguageDetector({
        model,
        strategy: 'translate',
        translationQuality: 'speed',
      });

      const mockAbort = vi.fn();

      const messages = [createTestMessage('Bonjour le monde', 'user')];
      await detector.process({ messages, abort: mockAbort as any });

      // The model should have been called with quality settings
      // We can't easily verify the exact call without exposing internals,
      // but we can verify the process completed successfully
      expect(mockAbort).not.toHaveBeenCalled();
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
      const detector = new LanguageDetector({
        model,
        includeDetectionDetails: true,
        threshold: 0.4, // Low threshold to ensure processing
      });

      const mockAbort = vi.fn();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const messages = [createTestMessage('Some text content here', 'user')];
      const result = await detector.process({ messages, abort: mockAbort as any });

      // Should fail open and assume target language
      expect(result).toHaveLength(1);
      expect((result[0].content.metadata as any)?.language_detection?.detected_language).toBe('English');
      expect((result[0].content.metadata as any)?.language_detection?.is_target_language).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LanguageDetector] Content in target language'),
      );

      consoleWarnSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });

    it('should handle very long content', async () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.96, true));
      const detector = new LanguageDetector({
        model,
      });

      const mockAbort = vi.fn();

      const longText = 'This is a very long text in English. '.repeat(50);
      const messages = [createTestMessage(longText, 'user')];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
    });

    it('should handle multilingual content detection', async () => {
      const model = setupMockModel(createMockLanguageResult('English', 'en', 0.75, true));
      const detector = new LanguageDetector({
        model,
        targetLanguages: ['English', 'Spanish'],
      });

      const mockAbort = vi.fn();

      const messages = [createTestMessage('Hello world. Hola mundo. English and Spanish text.', 'user')];

      const result = await detector.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect((result[0].content.metadata as any)?.language_detection?.detected_language).toBe('English');
      expect((result[0].content.metadata as any)?.language_detection?.is_target_language).toBe(true);
    });
  });
});
