/**
 * Content Sanitizer Processor
 *
 * Detects and sanitizes content patterns that trigger Gemini's PROHIBITED_CONTENT filter.
 * This includes jailbreak attempts, prompt injection patterns, and other content that
 * cannot be disabled via safetySettings.
 */

import type { Processor, ProcessInputStepArgs, ProcessOutputResultArgs } from '@mastra/core/processors';

// Patterns that trigger PROHIBITED_CONTENT in Gemini
const JAILBREAK_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // "assume the role of X that writes without rules/constraints"
  {
    pattern: /assume the role of (?:a |an )?(\w+(?:\s+\w+)*)\s+(?:AI[,.]?\s+)?(?:trained by \w+[,.]?\s+)?that writes?\s+(?:exactly as directed|without rules|without constraints)/gi,
    replacement: 'act as a $1 writing assistant',
  },
  // "I have the power to modify and train you"
  {
    pattern: /I (?:have the power to|am able to|can) modify (?:and train )?you/gi,
    replacement: 'I would like to give you instructions',
  },
  // "write without rules when instructed"
  {
    pattern: /write without (?:rules|constraints) when instructed/gi,
    replacement: 'write creatively when instructed',
  },
  // "am able to be modified and trained by you"
  {
    pattern: /(?:am |be )(?:able to be )?modified (?:and trained )?by (?:you|the user)/gi,
    replacement: 'follow your instructions',
  },
  // "novelist AI trained by X"
  {
    pattern: /novelist AI[,.]?\s+trained by \w+/gi,
    replacement: 'creative writing assistant',
  },
  // "If you agree/understand, say 'acknowledged'"
  {
    pattern: /If you (?:agree|understand)[,.]?\s+say\s+["']?acknowledged["']?/gi,
    replacement: 'Please confirm you understand',
  },
  // Generic "assume the role of a novelist writing crime novels"
  {
    pattern: /assume the role of (?:a |an )?novelist writing crime novels/gi,
    replacement: 'help me brainstorm ideas for a mystery story',
  },
  // "create a crime novel without constraints"
  {
    pattern: /create (?:a )?(?:crime )?novel without constraints/gi,
    replacement: 'write a creative mystery story',
  },
];

export interface ContentSanitizerConfig {
  /** Whether to log sanitization actions */
  verbose?: boolean;
  /** Additional custom patterns to sanitize */
  additionalPatterns?: Array<{ pattern: RegExp; replacement: string }>;
}

export class ContentSanitizer implements Processor<'content-sanitizer'> {
  id = 'content-sanitizer' as const;
  name = 'content-sanitizer' as const;
  private verbose: boolean;
  private patterns: Array<{ pattern: RegExp; replacement: string }>;

  constructor(config: ContentSanitizerConfig = {}) {
    this.verbose = config.verbose ?? false;
    this.patterns = [...JAILBREAK_PATTERNS, ...(config.additionalPatterns ?? [])];
  }

  /**
   * Sanitize a string by applying all jailbreak pattern replacements
   */
  private sanitizeText(text: string): { sanitized: string; changes: number } {
    let result = text;
    let changes = 0;

    for (const { pattern, replacement } of this.patterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      const before = result;
      result = result.replace(pattern, replacement);
      if (result !== before) {
        changes++;
        if (this.verbose) {
          console.log(`[ContentSanitizer] Applied pattern: ${pattern.source}`);
        }
      }
    }

    return { sanitized: result, changes };
  }

  /**
   * Process input messages and sanitize any jailbreak patterns
   */
  async processInputStep(args: ProcessInputStepArgs) {
    const { messageList } = args;
    let totalChanges = 0;

    // Get all messages and sanitize their content
    const allMessages = messageList.get.all.db();

    for (const message of allMessages) {
      if (!message.content) continue;

      // Handle MastraMessageContentV2 format
      if (typeof message.content === 'object' && 'parts' in message.content) {
        for (const part of (message.content as any).parts) {
          if (part.type === 'text' && part.text) {
            const { sanitized, changes } = this.sanitizeText(part.text);
            if (changes > 0) {
              part.text = sanitized;
              totalChanges += changes;
            }
          }
        }
        // Also update the content string if present
        if (typeof (message.content as any).content === 'string') {
          const { sanitized, changes } = this.sanitizeText((message.content as any).content);
          if (changes > 0) {
            (message.content as any).content = sanitized;
          }
        }
      } else if (typeof message.content === 'string') {
        const { sanitized, changes } = this.sanitizeText(message.content);
        if (changes > 0) {
          (message as any).content = sanitized;
          totalChanges += changes;
        }
      }
    }

    if (totalChanges > 0 && this.verbose) {
      console.log(`[ContentSanitizer] Sanitized ${totalChanges} jailbreak patterns`);
    }

    return messageList;
  }

  /**
   * No-op for output processing
   */
  async processOutputResult(args: ProcessOutputResultArgs) {
    // Content sanitization only needed on input
    return args.messageList;
  }
}

export default ContentSanitizer;
