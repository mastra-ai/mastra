import crypto from 'crypto';
import z from 'zod';
import type { MastraLanguageModel } from '../../index';
import { Agent } from '../../index';
import type { MastraMessageV2 } from '../../message-list';
import { TripWire } from '../../trip-wire';
import type { InputProcessor } from '../index';

/**
 * PII categories for detection and redaction
 */
export interface PIICategories {
  email?: boolean;
  phone?: boolean;
  'credit-card'?: boolean;
  ssn?: boolean;
  'api-key'?: boolean;
  'ip-address'?: boolean;
  name?: boolean;
  address?: boolean;
  'date-of-birth'?: boolean;
  url?: boolean;
  uuid?: boolean;
  'crypto-wallet'?: boolean;
  iban?: boolean;
  [customType: string]: boolean | undefined;
}

/**
 * Confidence scores for each PII category (0-1)
 */
export interface PIICategoryScores {
  email?: number;
  phone?: number;
  'credit-card'?: number;
  ssn?: number;
  'api-key'?: number;
  'ip-address'?: number;
  name?: number;
  address?: number;
  'date-of-birth'?: number;
  url?: number;
  uuid?: number;
  'crypto-wallet'?: number;
  iban?: number;
  [customType: string]: number | undefined;
}

/**
 * Individual PII detection with location and redaction info
 */
export interface PIIDetection {
  type: string;
  value: string;
  confidence: number;
  start: number;
  end: number;
  redacted_value?: string;
}

/**
 * Result structure for PII detection (simplified for minimal tokens)
 */
export interface PIIDetectionResult {
  categories?: PIICategoryScores;
  detections?: PIIDetection[];
  redacted_content?: string;
}

/**
 * Configuration options for PIIDetector
 */
export interface PIIDetectorOptions {
  /** Model configuration for the detection agent */
  model: MastraLanguageModel;

  /**
   * PII types to detect.
   * If not specified, uses default types.
   */
  detectionTypes?: string[];

  /**
   * Confidence threshold for flagging (0-1, default: 0.6)
   * PII is flagged if any category score exceeds this threshold
   */
  threshold?: number;

  /**
   * Strategy when PII is detected:
   * - 'block': Reject the entire input with an error
   * - 'warn': Log warning but allow content through
   * - 'filter': Remove flagged messages but continue with remaining
   * - 'redact': Replace detected PII with redacted versions (default)
   */
  strategy?: 'block' | 'warn' | 'filter' | 'redact';

  /**
   * Redaction method for PII:
   * - 'mask': Replace with asterisks (***@***.com)
   * - 'hash': Replace with SHA256 hash
   * - 'remove': Remove entirely
   * - 'placeholder': Replace with type placeholder ([EMAIL], [PHONE], etc.)
   */
  redactionMethod?: 'mask' | 'hash' | 'remove' | 'placeholder';

  /**
   * Custom detection instructions for the agent
   * If not provided, uses default instructions based on detection types
   */
  instructions?: string;

  /**
   * Whether to include detection details in logs (default: false)
   * Useful for compliance auditing and debugging
   */
  includeDetections?: boolean;

  /**
   * Whether to preserve PII format during redaction (default: true)
   * When true, maintains structure like ***-**-1234 for phone numbers
   */
  preserveFormat?: boolean;
}

/**
 * PIIDetector uses an internal Mastra agent to identify and redact
 * personally identifiable information for privacy compliance.
 *
 * Supports multiple redaction strategies and maintains audit trails
 * for compliance with GDPR, CCPA, HIPAA, and other privacy regulations.
 */
export class PIIDetector implements InputProcessor {
  readonly name = 'pii-detector';

  private detectionAgent: Agent;
  private detectionTypes: string[];
  private threshold: number;
  private strategy: 'block' | 'warn' | 'filter' | 'redact';
  private redactionMethod: 'mask' | 'hash' | 'remove' | 'placeholder';
  private includeDetections: boolean;
  private preserveFormat: boolean;

  // Default PII types based on common privacy regulations and comprehensive PII detection
  private static readonly DEFAULT_DETECTION_TYPES = [
    'email', // Email addresses
    'phone', // Phone numbers
    'credit-card', // Credit card numbers
    'ssn', // Social Security Numbers
    'api-key', // API keys and tokens
    'ip-address', // IP addresses (IPv4 and IPv6)
    'name', // Person names
    'address', // Physical addresses
    'date-of-birth', // Dates of birth
    'url', // URLs that might contain PII
    'uuid', // Universally Unique Identifiers
    'crypto-wallet', // Cryptocurrency wallet addresses
    'iban', // International Bank Account Numbers
  ];

  constructor(options: PIIDetectorOptions) {
    this.detectionTypes = options.detectionTypes || PIIDetector.DEFAULT_DETECTION_TYPES;
    this.threshold = options.threshold ?? 0.6;
    this.strategy = options.strategy || 'redact';
    this.redactionMethod = options.redactionMethod || 'mask';
    this.includeDetections = options.includeDetections ?? false;
    this.preserveFormat = options.preserveFormat ?? true;

    // Create internal detection agent
    this.detectionAgent = new Agent({
      name: 'pii-detector',
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

      // Evaluate each message
      for (const message of messages) {
        const textContent = this.extractTextContent(message);
        if (!textContent.trim()) {
          // No text content to analyze
          processedMessages.push(message);
          continue;
        }

        const detectionResult = await this.detectPII(textContent);

        if (this.isPIIFlagged(detectionResult)) {
          const processedMessage = this.handleDetectedPII(message, detectionResult, this.strategy, abort);

          // If we reach here, strategy is 'warn', 'filter', or 'redact'
          if (this.strategy === 'filter') {
            continue; // Skip this message
          } else if (this.strategy === 'redact') {
            if (processedMessage) {
              processedMessages.push(processedMessage);
            } else {
              processedMessages.push(message); // Fallback to original if redaction failed
            }
            continue;
          }
        }

        processedMessages.push(message);
      }

      return processedMessages;
    } catch (error) {
      if (error instanceof TripWire) {
        throw error; // Re-throw tripwire errors
      }
      throw new Error(`PII detection failed: ${error instanceof Error ? error.stack : 'Unknown error'}`);
    }
  }

  /**
   * Detect PII using the internal agent
   */
  private async detectPII(content: string): Promise<PIIDetectionResult> {
    const prompt = this.createDetectionPrompt(content);

    try {
      const response = await this.detectionAgent.generate(prompt, {
        output: z.object({
          categories: z
            .object(
              this.detectionTypes.reduce(
                (props, type) => {
                  props[type] = z.number().min(0).max(1).optional();
                  return props;
                },
                {} as Record<string, z.ZodType<number | undefined>>,
              ),
            )
            .optional(),
          detections: z
            .array(
              z.object({
                type: z.string(),
                value: z.string(),
                confidence: z.number().min(0).max(1),
                start: z.number(),
                end: z.number(),
                redacted_value: z.string().optional(),
              }),
            )
            .optional(),
          redacted_content: z.string().optional(),
        }),
        temperature: 0,
      });

      const result = response.object as PIIDetectionResult;

      // Apply redaction method if not already provided and we have detections
      if (!result.redacted_content && result.detections && result.detections.length > 0) {
        result.redacted_content = this.applyRedactionMethod(content, result.detections);
        result.detections = result.detections.map(detection => ({
          ...detection,
          redacted_value: detection.redacted_value || this.redactValue(detection.value, detection.type),
        }));
      }

      return result;
    } catch (error) {
      console.warn('[PIIDetector] Detection agent failed, allowing content:', error);
      // Fail open - return empty result if detection agent fails (no PII detected)
      return {};
    }
  }

  /**
   * Determine if PII is flagged based on detections or category scores above threshold
   */
  private isPIIFlagged(result: PIIDetectionResult): boolean {
    // Check if we have any detections
    if (result.detections && result.detections.length > 0) {
      return true;
    }

    // Check if any category scores exceed the threshold
    if (result.categories) {
      const maxScore = Math.max(
        ...(Object.values(result.categories).filter(score => typeof score === 'number') as number[]),
      );
      return maxScore >= this.threshold;
    }

    return false;
  }

  /**
   * Handle detected PII based on strategy
   */
  private handleDetectedPII(
    message: MastraMessageV2,
    result: PIIDetectionResult,
    strategy: 'block' | 'warn' | 'filter' | 'redact',
    abort: (reason?: string) => never,
  ): MastraMessageV2 | null {
    const detectedTypes = Object.entries(result.categories || {})
      .filter(([_, detected]) => detected)
      .map(([type]) => type);

    const alertMessage = `PII detected. Types: ${detectedTypes.join(', ')}${
      this.includeDetections && result.detections ? `. Detections: ${result.detections.length} items` : ''
    }`;

    switch (strategy) {
      case 'block':
        abort(alertMessage);

      case 'warn':
        console.warn(`[PIIDetector] ${alertMessage}`);
        return null; // Return null to indicate no message modification

      case 'filter':
        console.info(`[PIIDetector] Filtered message: ${alertMessage}`);
        return null; // Return null to indicate message should be filtered

      case 'redact':
        if (result.redacted_content) {
          console.info(`[PIIDetector] Redacted PII: ${alertMessage}`);
          return this.createRedactedMessage(message, result.redacted_content);
        } else {
          console.warn(`[PIIDetector] No redaction available, filtering: ${alertMessage}`);
          return null; // Fallback to filtering if no redaction available
        }

      default:
        return null;
    }
  }

  /**
   * Create a redacted message with PII removed/masked
   */
  private createRedactedMessage(originalMessage: MastraMessageV2, redactedContent: string): MastraMessageV2 {
    return {
      ...originalMessage,
      content: {
        ...originalMessage.content,
        parts: [{ type: 'text', text: redactedContent }],
        content: redactedContent,
      },
    };
  }

  /**
   * Apply redaction method to content
   */
  private applyRedactionMethod(content: string, detections: PIIDetection[]): string {
    let redacted = content;

    // Sort detections by start position in reverse order to maintain indices
    const sortedDetections = [...detections].sort((a, b) => b.start - a.start);

    for (const detection of sortedDetections) {
      const redactedValue = this.redactValue(detection.value, detection.type);
      redacted = redacted.slice(0, detection.start) + redactedValue + redacted.slice(detection.end);
    }

    return redacted;
  }

  /**
   * Redact individual PII value based on method and type
   */
  private redactValue(value: string, type: string): string {
    switch (this.redactionMethod) {
      case 'mask':
        return this.maskValue(value, type);
      case 'hash':
        return this.hashValue(value);
      case 'remove':
        return '';
      case 'placeholder':
        return `[${type.toUpperCase()}]`;
      default:
        return this.maskValue(value, type);
    }
  }

  /**
   * Mask PII value while optionally preserving format
   */
  private maskValue(value: string, type: string): string {
    if (!this.preserveFormat) {
      return '*'.repeat(Math.min(value.length, 8));
    }

    switch (type) {
      case 'email':
        const emailParts = value.split('@');
        if (emailParts.length === 2) {
          const [local, domain] = emailParts;
          const maskedLocal =
            local && local.length > 2 ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] : '***';
          const domainParts = domain?.split('.');
          const maskedDomain =
            domainParts && domainParts.length > 1
              ? '*'.repeat(domainParts[0]?.length ?? 0) + '.' + domainParts.slice(1).join('.')
              : '***';
          return `${maskedLocal}@${maskedDomain}`;
        }
        break;

      case 'phone':
        // Preserve format like XXX-XXX-1234 or (XXX) XXX-1234
        return value.replace(/\d/g, (match, index) => {
          // Keep last 4 digits
          return index >= value.length - 4 ? match : 'X';
        });

      case 'credit-card':
        // Show last 4 digits: ****-****-****-1234
        return value.replace(/\d/g, (match, index) => {
          return index >= value.length - 4 ? match : '*';
        });

      case 'ssn':
        // Show last 4 digits: ***-**-1234
        return value.replace(/\d/g, (match, index) => {
          return index >= value.length - 4 ? match : '*';
        });

      case 'uuid':
        // Mask UUID: ********-****-****-****-************
        return value.replace(/[a-f0-9]/gi, '*');

      case 'crypto-wallet':
        // Show first 4 and last 4 characters: 1Lbc...X71
        if (value.length > 8) {
          return value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4);
        }
        return '*'.repeat(value.length);

      case 'iban':
        // Show country code and last 4 digits: DE**************3000
        if (value.length > 6) {
          return value.slice(0, 2) + '*'.repeat(value.length - 6) + value.slice(-4);
        }
        return '*'.repeat(value.length);

      default:
        // Generic masking - show first and last character if long enough
        if (value.length <= 3) {
          return '*'.repeat(value.length);
        }
        return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1];
    }

    return '*'.repeat(Math.min(value.length, 8));
  }

  /**
   * Hash PII value using SHA256
   */
  private hashValue(value: string): string {
    return `[HASH:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 8)}]`;
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
   * Create default detection instructions
   */
  private createDefaultInstructions(): string {
    return `You are a PII (Personally Identifiable Information) detection specialist. Your job is to identify and locate sensitive personal information in text content for privacy compliance.

Detect and analyze the following PII types:
${this.detectionTypes.map(type => `- ${type}`).join('\n')}

IMPORTANT: IF NO PII IS DETECTED, RETURN AN EMPTY OBJECT, DO NOT INCLUDE ANYTHING ELSE. Do not include any zeros in your response, if the response should be 0, omit it, they will be counted as false.`;
  }

  /**
   * Create detection prompt for the agent
   */
  private createDetectionPrompt(content: string): string {
    return `Analyze the following content for PII (Personally Identifiable Information):
Content: "${content}"`;
  }
}
