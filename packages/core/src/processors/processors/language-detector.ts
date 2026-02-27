import type { SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import z from 'zod';
import { Agent, isSupportedLanguageModel } from '../../agent';
import type { MastraDBMessage } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { ProviderOptions } from '../../llm/model/provider-options';
import type { MastraModelConfig } from '../../llm/model/shared.types';
import type { ObservabilityContext } from '../../observability';
import { resolveObservabilityContext } from '../../observability';
import type { Processor } from '../index';

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
 * Language detection and translation result (simplified for minimal tokens)
 */
export interface LanguageDetectionResult {
  iso_code: string | null;
  confidence: number | null;
  translated_text?: string | null; // Only present when strategy is 'translate'
}

/**
 * Configuration options for LanguageDetector
 */
export interface LanguageDetectorOptions {
  /** Model configuration for the detection/translation agent */
  model: MastraModelConfig;

  /**
   * Target language(s) for the project.
   * If content is detected in a different language, it may be translated.
   * Can be language name ('English') or ISO code ('en')
   */
  targetLanguages: string[];

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

  /**
   * Provider-specific options passed to the internal detection agent.
   * Use this to control model behavior like reasoning effort for thinking models.
   *
   * @example
   * ```ts
   * providerOptions: {
   *   openai: { reasoningEffort: 'low' }
   * }
   * ```
   */
  providerOptions?: ProviderOptions;
}

/**
 * LanguageDetector identifies the language of input text and optionally
 * translates it to a target language for consistent processing.
 *
 * Supports 100+ languages via internal agent-based detection and translation,
 * making it ideal for multilingual AI applications and global deployment.
 */
export class LanguageDetector implements Processor<'language-detector'> {
  readonly id = 'language-detector';
  readonly name = 'Language Detector';

  private detectionAgent: Agent;
  private targetLanguages: string[];
  private threshold: number;
  private strategy: 'detect' | 'translate' | 'block' | 'warn';
  private preserveOriginal: boolean;
  private minTextLength: number;
  private includeDetectionDetails: boolean;
  private translationQuality: 'speed' | 'quality' | 'balanced';
  private providerOptions?: ProviderOptions;

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
    this.providerOptions = options.providerOptions;

    // Create internal detection and translation agent
    this.detectionAgent = new Agent({
      id: 'language-detector',
      name: 'Language Detector',
      instructions: options.instructions || this.createDefaultInstructions(),
      model: options.model,
    });
  }

  async processInput(
    args: {
      messages: MastraDBMessage[];
      abort: (reason?: string) => never;
    } & Partial<ObservabilityContext>,
  ): Promise<MastraDBMessage[]> {
    try {
      const { messages, abort, ...rest } = args;
      const observabilityContext = resolveObservabilityContext(rest);

      if (messages.length === 0) {
        return messages;
      }

      const processedMessages: MastraDBMessage[] = [];

      // Process each message
      for (const message of messages) {
        const textContent = this.extractTextContent(message);
        if (textContent.length < this.minTextLength) {
          // Text too short for reliable detection
          processedMessages.push(message);
          continue;
        }

        const detectionResult = await this.detectLanguage(textContent, observabilityContext);

        // Check if confidence meets threshold
        if (detectionResult.confidence && detectionResult.confidence < this.threshold) {
          // Detection confidence too low, proceed with original (no metadata)
          processedMessages.push(message);
          continue;
        }

        // If no detection result or target language, assume target language and add minimal metadata
        if (!this.isNonTargetLanguage(detectionResult)) {
          const targetLanguageCode = this.getLanguageCode(this.targetLanguages[0]!);
          const targetMessage = this.addLanguageMetadata(message, {
            iso_code: targetLanguageCode,
            confidence: 0.95,
          });

          if (this.includeDetectionDetails) {
            console.info(
              `[LanguageDetector] Content in target language: Language detected: ${this.getLanguageName(targetLanguageCode)} (${targetLanguageCode}) with confidence 0.95`,
            );
          }

          processedMessages.push(targetMessage);
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
      if (error instanceof TripWire) {
        throw error; // Re-throw tripwire errors
      }
      args.abort(`Language detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect language using the internal agent
   */
  private async detectLanguage(
    content: string,
    observabilityContext?: ObservabilityContext,
  ): Promise<LanguageDetectionResult> {
    const prompt = this.createDetectionPrompt(content);

    try {
      const model = await this.detectionAgent.getModel();
      let response;

      const baseSchema = z.object({
        iso_code: z.string().describe('ISO language code').nullable(),
        confidence: z.number().min(0).max(1).describe('Detection confidence').nullable(),
      });

      const schema =
        this.strategy === 'translate'
          ? baseSchema.extend({
              translated_text: z.string().describe('Translated text').nullable(),
            })
          : baseSchema;

      if (isSupportedLanguageModel(model)) {
        response = await this.detectionAgent.generate(prompt, {
          structuredOutput: {
            schema,
          },
          modelSettings: {
            temperature: 0,
          },
          providerOptions: this.providerOptions,
          ...observabilityContext,
        });
      } else {
        response = await this.detectionAgent.generateLegacy(prompt, {
          output: schema,
          temperature: 0,
          providerOptions: this.providerOptions as SharedV2ProviderOptions,
          ...observabilityContext,
        });
      }

      const result = response.object as LanguageDetectionResult;

      if (result.translated_text && !result.confidence) {
        result.confidence = 0.95;
      }

      return result;
    } catch (error) {
      console.warn('[LanguageDetector] Detection agent failed, assuming target language:', error);
      // Fail open - assume target language if detection fails
      return {
        iso_code: null,
        confidence: null,
      };
    }
  }

  /**
   * Determine if language detection indicates non-target language
   */
  private isNonTargetLanguage(result: LanguageDetectionResult): boolean {
    // If we got back iso_code and confidence, check if it's non-target
    if (result.iso_code && result.confidence && result.confidence >= this.threshold) {
      return !this.isTargetLanguage(result.iso_code);
    }
    return false;
  }

  /**
   * Get detected language name from ISO code
   */
  private getLanguageName(isoCode: string): string {
    return LanguageDetector.LANGUAGE_MAP[isoCode.toLowerCase()] || isoCode;
  }

  /**
   * Handle detected language based on strategy
   */
  private async handleDetectedLanguage(
    message: MastraDBMessage,
    result: LanguageDetectionResult,
    strategy: 'detect' | 'translate' | 'block' | 'warn',
    abort: (reason?: string) => never,
  ): Promise<MastraDBMessage | null> {
    const detectedLanguage = result.iso_code ? this.getLanguageName(result.iso_code) : 'Unknown';
    const alertMessage = `Language detected: ${detectedLanguage} (${result.iso_code}) with confidence ${result.confidence?.toFixed(2)}`;

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

      case 'translate':
        if (result.translated_text) {
          console.info(`[LanguageDetector] Translated from ${detectedLanguage}: ${alertMessage}`);
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
  private createTranslatedMessage(originalMessage: MastraDBMessage, result: LanguageDetectionResult): MastraDBMessage {
    if (!result.translated_text) {
      return this.addLanguageMetadata(originalMessage, result);
    }

    const translatedMessage: MastraDBMessage = {
      ...originalMessage,
      content: {
        ...originalMessage.content,
        parts: [{ type: 'text', text: result.translated_text }],
        content: result.translated_text,
      },
    };

    return this.addLanguageMetadata(translatedMessage, result, originalMessage);
  }

  /**
   * Add language detection metadata to message
   */
  private addLanguageMetadata(
    message: MastraDBMessage,
    result: LanguageDetectionResult,
    originalMessage?: MastraDBMessage,
  ): MastraDBMessage {
    const isTargetLanguage = this.isTargetLanguage(result.iso_code ?? undefined);

    const metadata = {
      ...message.content.metadata,
      language_detection: {
        ...(result.iso_code && {
          detected_language: this.getLanguageName(result.iso_code),
          iso_code: result.iso_code,
        }),
        ...(result.confidence && { confidence: result.confidence }),
        is_target_language: isTargetLanguage,
        target_languages: this.targetLanguages,
        ...(result.translated_text && {
          translation: {
            original_language: result.iso_code ? this.getLanguageName(result.iso_code) : 'Unknown',
            target_language: this.targetLanguages[0],
            ...(result.confidence && { translation_confidence: result.confidence }),
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
   * Check if detected language is a target language
   */
  private isTargetLanguage(isoCode?: string): boolean {
    if (!isoCode) return true; // Assume target if no detection

    return this.targetLanguages.some(target => {
      const targetCode = this.getLanguageCode(target);
      return (
        targetCode === isoCode.toLowerCase() || target.toLowerCase() === this.getLanguageName(isoCode).toLowerCase()
      );
    });
  }

  /**
   * Extract text content from message for analysis
   */
  private extractTextContent(message: MastraDBMessage): string {
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
    return `You are a language detection specialist. Identify the language of text content and translate if needed.

IMPORTANT: IF CONTENT IS ALREADY IN TARGET LANGUAGE, RETURN AN EMPTY OBJECT. Do not include any zeros or false values.`;
  }

  /**
   * Create detection prompt for the agent
   */
  private createDetectionPrompt(content: string): string {
    const translate =
      this.strategy === 'translate'
        ? `. If not in ${this.targetLanguages[0]}, translate to ${this.targetLanguages[0]}`
        : '';

    return `Detect language of: "${content}"

Target: ${this.targetLanguages.join('/')}${translate}`;
  }
}
