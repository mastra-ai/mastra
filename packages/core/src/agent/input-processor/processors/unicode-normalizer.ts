import type { MastraMessageV2 } from '../../message-list';
import type { InputProcessor } from '../index';

export interface UnicodeNormalizerOptions {
  /**
   * Whether to strip control characters (default: false)
   * When enabled, removes control characters except \t, \n, \r
   */
  stripControlChars?: boolean;

  /**
   * Whether to preserve emojis (default: true)
   * When disabled, emojis may be removed if they contain control characters
   */
  preserveEmojis?: boolean;

  /**
   * Whether to collapse consecutive whitespace (default: true)
   * When enabled, multiple spaces/tabs/newlines are collapsed to single instances
   */
  collapseWhitespace?: boolean;

  /**
   * Whether to trim leading and trailing whitespace (default: true)
   */
  trim?: boolean;
}

export class UnicodeNormalizer implements InputProcessor {
  readonly name = 'unicode-normalizer';

  private options: Required<UnicodeNormalizerOptions>;

  constructor(options: UnicodeNormalizerOptions = {}) {
    this.options = {
      stripControlChars: options.stripControlChars ?? false,
      preserveEmojis: options.preserveEmojis ?? true,
      collapseWhitespace: options.collapseWhitespace ?? true,
      trim: options.trim ?? true,
    };
  }

  process(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never }): MastraMessageV2[] {
    try {
      return args.messages.map(message => ({
        ...message,
        content: {
          ...message.content,
          parts: message.content.parts?.map(part => {
            if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
              return {
                ...part,
                text: this.normalizeText(part.text),
              };
            }
            return part;
          }),
          content:
            typeof message.content.content === 'string'
              ? this.normalizeText(message.content.content)
              : message.content.content,
        },
      }));
    } catch {
      // do nothing, this isn't a critical processor
      return args.messages;
    }
  }

  private normalizeText(text: string): string {
    let normalized = text;

    // Step 1: Unicode normalization to NFKC (security-friendly)
    // NFKC decomposes characters and then recomposes them in canonical form
    // This helps prevent homograph attacks and unicode confusables
    normalized = normalized.normalize('NFKC');

    // Step 2: Strip control characters if enabled
    if (this.options.stripControlChars) {
      if (this.options.preserveEmojis) {
        // More conservative approach: only remove specific problematic control chars
        // while preserving emojis and other unicode symbols
        normalized = normalized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
      } else {
        // Remove all control characters except tab, newline, carriage return
        normalized = normalized.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, '');
      }
    }

    // Step 3: Collapse whitespace if enabled
    if (this.options.collapseWhitespace) {
      // First normalize line endings: convert all to \n
      normalized = normalized.replace(/\r\n/g, '\n'); // Convert CRLF to LF
      normalized = normalized.replace(/\r/g, '\n'); // Convert lone CR to LF
      // Then collapse multiple consecutive newlines to single newline
      normalized = normalized.replace(/\n+/g, '\n');
      // Collapse multiple consecutive spaces to single space
      normalized = normalized.replace(/[ \t]+/g, ' ');
    }

    // Step 4: Trim if enabled
    if (this.options.trim) {
      normalized = normalized.trim();
    }

    return normalized;
  }
}
