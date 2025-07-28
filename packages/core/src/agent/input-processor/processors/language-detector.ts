import z from 'zod';
import type { MastraLanguageModel } from '../../index';
import { Agent } from '../../index';
import type { MastraMessageV2 } from '../../message-list';
import type { InputProcessor } from '../index';

/**
 * Language detection result for a single text
 */
export interface LanguageDetection {
  language: string;
  confidence: number;
  iso_code: string;
}

/**
 * Translation result
 */
export interface TranslationResult {
  original_text: string;
  original_language: string;
  translated_text: string;
  target_language: string;
  confidence: number;
}

/**
 * Language detection and translation result
 */
export interface LanguageDetectionResult {
  detected_language: string;
  iso_code: string;
  confidence: number;
  is_target_language: boolean;
  translation?: TranslationResult;
  reason?: string;
}

/**
 * Configuration options for LanguageDetector
 */
export interface LanguageDetectorOptions {
  /** Model configuration for the detection/translation agent */
  model: MastraLanguageModel;

  /**
   * Target language(s) for the project.
   * If content is detected in a different language, it may be translated.
   * Can be language name ('English') or ISO code ('en')
   */
  targetLanguages?: string[];

  /**
   * Confidence threshold for language detection (0-1, default: 0.7)
   * Only process when detection confidence exceeds this threshold
   */
  threshold?: number;

  /**
   * Strategy when non-target language is detected:
   * - 'detect': Only detect language, don't translate (default)
   * - 'translate': Automatically translate to target language
   * - 'block': Reject content not in target language
   * - 'warn': Log warning but allow content through
   */
  strategy?: 'detect' | 'translate' | 'block' | 'warn';

  /**
   * Whether to preserve original content in message metadata (default: true)
   * Useful for audit trails and debugging
   */
  preserveOriginal?: boolean;

  /**
   * Custom detection instructions for the agent
   * If not provided, uses default instructions
   */
  instructions?: string;

  /**
   * Minimum text length to perform detection (default: 10)
   * Short text is often unreliable for language detection
   */
  minTextLength?: number;

  /**
   * Whether to include detailed detection info in logs (default: false)
   */
  includeDetectionDetails?: boolean;

  /**
   * Translation quality preference:
   * - 'speed': Prioritize fast translation
   * - 'quality': Prioritize translation accuracy (default)
   * - 'balanced': Balance between speed and quality
   */
  translationQuality?: 'speed' | 'quality' | 'balanced';
}

/**
 * LanguageDetector identifies the language of input text and optionally
 * translates it to a target language for consistent processing.
 *
 * Supports 100+ languages via internal agent-based detection and translation,
 * making it ideal for multilingual AI applications and global deployment.
 */
export class LanguageDetector implements InputProcessor {
  readonly name = 'language-detector';

  private detectionAgent: Agent;
  private targetLanguages: string[];
  private threshold: number;
  private strategy: 'detect' | 'translate' | 'block' | 'warn';
  private preserveOriginal: boolean;
  private minTextLength: number;
  private includeDetectionDetails: boolean;
  private translationQuality: 'speed' | 'quality' | 'balanced';

  // Default target language
  private static readonly DEFAULT_TARGET_LANGUAGES = ['English', 'en'];

  // Common language codes and names mapping
  private static readonly LANGUAGE_MAP: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ru: 'Russian',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
    'zh-cn': 'Chinese (Simplified)',
    'zh-tw': 'Chinese (Traditional)',
    ar: 'Arabic',
    hi: 'Hindi',
    th: 'Thai',
    vi: 'Vietnamese',
    tr: 'Turkish',
    pl: 'Polish',
    nl: 'Dutch',
    sv: 'Swedish',
    da: 'Danish',
    no: 'Norwegian',
    fi: 'Finnish',
    el: 'Greek',
    he: 'Hebrew',
    cs: 'Czech',
    hu: 'Hungarian',
    ro: 'Romanian',
    bg: 'Bulgarian',
    hr: 'Croatian',
    sk: 'Slovak',
    sl: 'Slovenian',
    et: 'Estonian',
    lv: 'Latvian',
    lt: 'Lithuanian',
    uk: 'Ukrainian',
    be: 'Belarusian',
  };

  constructor(options: LanguageDetectorOptions) {
    this.targetLanguages = options.targetLanguages || LanguageDetector.DEFAULT_TARGET_LANGUAGES;
    this.threshold = options.threshold ?? 0.7;
    this.strategy = options.strategy || 'detect';
    this.preserveOriginal = options.preserveOriginal ?? true;
    this.minTextLength = options.minTextLength ?? 10;
    this.includeDetectionDetails = options.includeDetectionDetails ?? false;
    this.translationQuality = options.translationQuality || 'quality';

    // Create internal detection and translation agent
    this.detectionAgent = new Agent({
      name: 'language-detector',
      instructions: options.instructions || this.createDefaultInstructions(),
      model: options.model,
    });
  }

  async process(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never }): Promise<MastraMessageV2[]> {
    try {
      const { messages, abort } = args;

      if (messages.length === 0) {
        return messages;
      }

      const processedMessages: MastraMessageV2[] = [];

      // Process each message
      for (const message of messages) {
        const textContent = this.extractTextContent(message);
        if (textContent.length < this.minTextLength) {
          // Text too short for reliable detection
          processedMessages.push(message);
          continue;
        }

        const detectionResult = await this.detectLanguage(textContent);

        if (detectionResult.confidence < this.threshold) {
          // Detection confidence too low, proceed with original
          processedMessages.push(message);
          continue;
        }

        const processedMessage = await this.handleDetectedLanguage(message, detectionResult, this.strategy, abort);

        if (processedMessage) {
          processedMessages.push(processedMessage);
        } else {
          // Strategy was 'block' and non-target language detected
          continue;
        }
      }

      return processedMessages;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Tripwire')) {
        throw error; // Re-throw tripwire errors
      }
      args.abort(`Language detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect language using the internal agent
   */
  private async detectLanguage(content: string): Promise<LanguageDetectionResult> {
    const prompt = this.createDetectionPrompt(content);

    try {
      const response = await this.detectionAgent.generate(prompt, {
        output: z.object({
          detected_language: z.string(),
          iso_code: z.string(),
          confidence: z.number().min(0).max(1),
          is_target_language: z.boolean(),
          translation: z
            .object({
              original_text: z.string(),
              original_language: z.string(),
              translated_text: z.string(),
              target_language: z.string(),
              confidence: z.number().min(0).max(1),
            })
            .optional(),
          reason: z.string().optional(),
        }),
        temperature: 0,
      });

      return response.object;
    } catch (error) {
      console.warn('[LanguageDetector] Detection agent failed, assuming target language:', error);
      // Fail open - assume target language if detection fails
      return {
        detected_language: this.targetLanguages[0] || 'English',
        iso_code: this.getLanguageCode(this.targetLanguages[0] || 'English'),
        confidence: 0.5,
        is_target_language: true,
        reason: 'Detection agent failed, assumed target language',
      };
    }
  }

  /**
   * Handle detected language based on strategy
   */
  private async handleDetectedLanguage(
    message: MastraMessageV2,
    result: LanguageDetectionResult,
    strategy: 'detect' | 'translate' | 'block' | 'warn',
    abort: (reason?: string) => never,
  ): Promise<MastraMessageV2 | null> {
    const alertMessage = `Language detected: ${result.detected_language} (${result.iso_code}) with confidence ${result.confidence.toFixed(2)}${
      result.reason ? `. ${result.reason}` : ''
    }${this.includeDetectionDetails ? `. Target languages: ${this.targetLanguages.join(', ')}` : ''}`;

    // If already in target language, return as-is
    if (result.is_target_language) {
      if (this.includeDetectionDetails) {
        console.info(`[LanguageDetector] Content in target language: ${alertMessage}`);
      }
      return this.addLanguageMetadata(message, result);
    }

    // Handle non-target language based on strategy
    switch (strategy) {
      case 'detect':
        console.info(`[LanguageDetector] ${alertMessage}`);
        return this.addLanguageMetadata(message, result);

      case 'warn':
        console.warn(`[LanguageDetector] Non-target language: ${alertMessage}`);
        return this.addLanguageMetadata(message, result);

      case 'block':
        const blockMessage = `Non-target language detected: ${alertMessage}`;
        console.info(`[LanguageDetector] Blocking: ${blockMessage}`);
        abort(blockMessage);
        return null; // Never reached

      case 'translate':
        if (result.translation) {
          console.info(`[LanguageDetector] Translated from ${result.detected_language}: ${alertMessage}`);
          return this.createTranslatedMessage(message, result);
        } else {
          console.warn(`[LanguageDetector] No translation available, keeping original: ${alertMessage}`);
          return this.addLanguageMetadata(message, result);
        }

      default:
        return this.addLanguageMetadata(message, result);
    }
  }

  /**
   * Create a translated message with original preserved in metadata
   */
  private createTranslatedMessage(originalMessage: MastraMessageV2, result: LanguageDetectionResult): MastraMessageV2 {
    if (!result.translation) {
      return this.addLanguageMetadata(originalMessage, result);
    }

    const translatedMessage: MastraMessageV2 = {
      ...originalMessage,
      content: {
        ...originalMessage.content,
        parts: [{ type: 'text', text: result.translation.translated_text }],
        content: result.translation.translated_text,
      },
    };

    return this.addLanguageMetadata(translatedMessage, result, originalMessage);
  }

  /**
   * Add language detection metadata to message
   */
  private addLanguageMetadata(
    message: MastraMessageV2,
    result: LanguageDetectionResult,
    originalMessage?: MastraMessageV2,
  ): MastraMessageV2 {
    const metadata = {
      ...message.content.metadata,
      language_detection: {
        detected_language: result.detected_language,
        iso_code: result.iso_code,
        confidence: result.confidence,
        is_target_language: result.is_target_language,
        target_languages: this.targetLanguages,
        ...(result.translation && {
          translation: {
            original_language: result.translation.original_language,
            target_language: result.translation.target_language,
            translation_confidence: result.translation.confidence,
          },
        }),
        ...(this.preserveOriginal &&
          originalMessage && {
            original_content: this.extractTextContent(originalMessage),
          }),
      },
    };

    return {
      ...message,
      content: {
        ...message.content,
        metadata,
      },
    };
  }

  /**
   * Extract text content from message for analysis
   */
  private extractTextContent(message: MastraMessageV2): string {
    let text = '';

    if (message.content.parts) {
      for (const part of message.content.parts) {
        if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
          text += part.text + ' ';
        }
      }
    }

    if (!text.trim() && typeof message.content.content === 'string') {
      text = message.content.content;
    }

    return text.trim();
  }

  /**
   * Get language code from language name or vice versa
   */
  private getLanguageCode(language: string): string {
    const lowerLang = language.toLowerCase();

    // If it's already a code, return it
    if (LanguageDetector.LANGUAGE_MAP[lowerLang]) {
      return lowerLang;
    }

    // Find code by name
    for (const [code, name] of Object.entries(LanguageDetector.LANGUAGE_MAP)) {
      if (name.toLowerCase() === lowerLang) {
        return code;
      }
    }

    // Default fallback
    return lowerLang.length <= 3 ? lowerLang : 'unknown';
  }

  /**
   * Create default detection and translation instructions
   */
  private createDefaultInstructions(): string {
    return `You are a language detection and translation specialist. Your job is to identify the language of text content and optionally translate it.

**Target Languages**: ${this.targetLanguages.join(', ')}

**Detection Guidelines**:
1. Identify the primary language of the input text
2. Provide the language name and ISO 639-1/639-2 code
3. Give a confidence score between 0-1 (1 = definitely this language)
4. Determine if the detected language matches any target language
5. Consider context, script, common words, and grammatical patterns

**Translation Guidelines** (when strategy is 'translate'):
1. If the content is NOT in a target language, translate it to the primary target language
2. Preserve meaning, tone, and intent as much as possible
3. Handle technical terms, proper nouns, and cultural references appropriately
4. Maintain formatting and structure where possible
5. Provide translation confidence score

**Quality Level**: ${this.translationQuality}
- speed: Quick translation, may sacrifice some nuance
- quality: Careful translation preserving all nuances
- balanced: Good balance of speed and accuracy

**Language Coverage**: Support for 100+ languages including:
- Major languages: English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese, Arabic, Hindi
- European: Dutch, Swedish, Polish, Czech, Hungarian, Romanian, Greek, Finnish, etc.
- Asian: Thai, Vietnamese, Indonesian, Malay, Tagalog, Bengali, Tamil, etc.
- Others: Turkish, Hebrew, Ukrainian, Bulgarian, Croatian, etc.

**Response Format**:
- detected_language: Full language name (e.g., "Spanish", "Japanese")
- iso_code: Standard language code (e.g., "es", "ja", "zh-cn")
- confidence: Detection confidence (0-1)
- is_target_language: Boolean indicating if it matches target languages
- translation: Optional translation object if content needs translation
- reason: Brief explanation of detection

**Detection Examples**:
- "Hello, how are you?" → English (en), confidence: 0.95
- "Bonjour, comment allez-vous?" → French (fr), confidence: 0.92  
- "こんにちは、元気ですか？" → Japanese (ja), confidence: 0.98
- "Hola, ¿cómo estás?" → Spanish (es), confidence: 0.90

**Translation Examples** (when needed):
- French "Bonjour le monde" → English "Hello world"
- Spanish "¿Cómo está usted?" → English "How are you?"
- Japanese "ありがとうございます" → English "Thank you"

Be accurate with language detection and natural with translations.`;
  }

  /**
   * Create detection prompt for the agent
   */
  private createDetectionPrompt(content: string): string {
    const needsTranslation = this.strategy === 'translate' ? ' and translate if needed' : '';

    return `Analyze the following text for language detection${needsTranslation}:

Content: "${content}"

Target languages: ${this.targetLanguages.join(', ')}
Translation quality: ${this.translationQuality}
Strategy: ${this.strategy}

Provide:
1. Language detection with confidence score
2. Whether it matches any target language
${this.strategy === 'translate' ? '3. Translation to primary target language if not already in target language' : ''}

Focus on accuracy for detection and natural translation if needed.`;
  }
}
