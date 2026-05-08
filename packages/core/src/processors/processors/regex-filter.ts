import type { MastraDBMessage } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { ChunkType } from '../../stream';
import type {
  ProcessInputArgs,
  ProcessInputResult,
  ProcessOutputResultArgs,
  ProcessOutputStreamArgs,
  ProcessorMessageResult,
  Processor,
} from '../index';

/**
 * A single regex rule for matching content
 */
export interface RegexRule {
  /** Display name for the rule (used in match reports and error messages) */
  name: string;
  /** The regex pattern to match against */
  pattern: RegExp;
  /** Replacement string for redact strategy. Defaults to '[REDACTED]' */
  replacement?: string;
}

/**
 * A match found by the regex filter
 */
export interface RegexMatch {
  /** The rule that matched */
  rule: string;
  /** The matched text */
  match: string;
  /** Start index of the match in the text */
  index: number;
}

/**
 * Metadata attached to the TripWire when the regex filter blocks
 */
export interface RegexFilterTripwireMetadata {
  processorId: 'regex-filter';
  matches: RegexMatch[];
  strategy: 'block';
}

/**
 * Built-in preset categories for common regex patterns
 */
export type RegexPreset = 'pii' | 'secrets' | 'urls';

/**
 * Configuration options for RegexFilterProcessor
 */
export interface RegexFilterOptions {
  /**
   * Custom regex rules to apply.
   * Each rule has a name, a regex pattern, and an optional replacement string.
   */
  rules?: RegexRule[];

  /**
   * Built-in presets to include.
   * - 'pii': Emails, phone numbers, SSNs, credit card numbers
   * - 'secrets': API keys, tokens, passwords in common formats
   * - 'urls': HTTP/HTTPS URLs
   */
  presets?: RegexPreset[];

  /**
   * Strategy when a pattern match is found:
   * - 'block': Abort with a TripWire error (default)
   * - 'redact': Replace matched content with replacement text
   * - 'warn': Log a warning but pass content through unchanged
   */
  strategy?: 'block' | 'redact' | 'warn';

  /**
   * Phases to apply the filter:
   * - 'input': Filter input messages (processInput)
   * - 'output': Filter output stream and result (processOutputStream + processOutputResult)
   * - 'all': Filter both input and output (default)
   */
  phase?: 'input' | 'output' | 'all';
}

const PII_RULES: RegexRule[] = [
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL]',
  },
  {
    name: 'phone',
    pattern: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
    replacement: '[PHONE]',
  },
  {
    name: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN]',
  },
  {
    name: 'credit-card',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CREDIT_CARD]',
  },
];

const SECRETS_RULES: RegexRule[] = [
  {
    name: 'api-key',
    pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*["']?[a-zA-Z0-9_\-]{20,}["']?/gi,
    replacement: '[API_KEY]',
  },
  {
    name: 'bearer-token',
    pattern: /Bearer\s+[a-zA-Z0-9_\-.]+/gi,
    replacement: '[BEARER_TOKEN]',
  },
  {
    name: 'aws-key',
    pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
    replacement: '[AWS_KEY]',
  },
];

const URL_RULES: RegexRule[] = [
  {
    name: 'url',
    pattern: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,
    replacement: '[URL]',
  },
];

const PRESET_MAP: Record<RegexPreset, RegexRule[]> = {
  pii: PII_RULES,
  secrets: SECRETS_RULES,
  urls: URL_RULES,
};

/**
 * RegexFilterProcessor applies zero-cost regex pattern matching to filter, redact, or block
 * content in agent messages. No LLM calls are made — all detection is regex-based.
 *
 * Supports built-in presets for common patterns (PII, secrets, URLs) and
 * custom regex rules. Can be applied to input, output, or both phases.
 *
 * @example Block emails and phone numbers in input:
 * ```typescript
 * new RegexFilterProcessor({
 *   presets: ['pii'],
 *   strategy: 'block',
 *   phase: 'input',
 * })
 * ```
 *
 * @example Redact secrets in output:
 * ```typescript
 * new RegexFilterProcessor({
 *   presets: ['secrets'],
 *   strategy: 'redact',
 *   phase: 'output',
 * })
 * ```
 *
 * @example Custom rules:
 * ```typescript
 * new RegexFilterProcessor({
 *   rules: [
 *     { name: 'internal-id', pattern: /INTERNAL-\d{6}/g, replacement: '[INTERNAL_ID]' },
 *   ],
 *   strategy: 'redact',
 * })
 * ```
 */
export class RegexFilterProcessor implements Processor<'regex-filter', RegexFilterTripwireMetadata> {
  public readonly id = 'regex-filter' as const;
  public readonly name = 'Regex Filter';

  private rules: RegexRule[];
  private strategy: 'block' | 'redact' | 'warn';
  private phase: 'input' | 'output' | 'all';

  constructor(options: RegexFilterOptions) {
    const presetRules = (options.presets ?? []).flatMap(preset => PRESET_MAP[preset] ?? []);
    this.rules = [...presetRules, ...(options.rules ?? [])];

    if (this.rules.length === 0) {
      throw new Error('RegexFilterProcessor requires at least one rule or preset');
    }

    this.strategy = options.strategy ?? 'block';
    this.phase = options.phase ?? 'all';
  }

  private findMatches(text: string): RegexMatch[] {
    const matches: RegexMatch[] = [];
    for (const rule of this.rules) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        matches.push({ rule: rule.name, match: m[0], index: m.index });
        if (!regex.global) break;
        if (m[0].length === 0) {
          regex.lastIndex++;
        }
      }
    }
    return matches;
  }

  private redactText(text: string): string {
    let result = text;
    for (const rule of this.rules) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      result = result.replace(regex, rule.replacement ?? '[REDACTED]');
    }
    return result;
  }

  private extractSegments(messages: MastraDBMessage[]): string[] {
    const segments: string[] = [];
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        segments.push(msg.content);
      } else if (msg.content && typeof msg.content === 'object') {
        const content = msg.content as { parts?: Array<{ type: string; text?: string }> };
        if (content.parts) {
          for (const part of content.parts) {
            if (part.type === 'text' && part.text) {
              segments.push(part.text);
            }
          }
        }
      }
    }
    return segments;
  }

  private findMatchesInMessages(messages: MastraDBMessage[]): RegexMatch[] {
    const allMatches: RegexMatch[] = [];
    for (const segment of this.extractSegments(messages)) {
      allMatches.push(...this.findMatches(segment));
    }
    return allMatches;
  }

  private blockWithTripWire(matches: RegexMatch[], context: string): never {
    const ruleNames = [...new Set(matches.map(m => m.rule))].join(', ');
    throw new TripWire<RegexFilterTripwireMetadata>(
      `Regex filter: blocked ${context} matching patterns: ${ruleNames}`,
      {
        retry: false,
        metadata: {
          processorId: this.id,
          matches: matches.map(m => ({
            ...m,
            match: '[REDACTED_MATCH]',
          })),
          strategy: 'block',
        },
      },
    );
  }

  private handleMatches(matches: RegexMatch[], context: string): void {
    if (matches.length === 0) return;

    if (this.strategy === 'warn') {
      const ruleNames = [...new Set(matches.map(m => m.rule))].join(', ');
      console.warn(`[RegexFilterProcessor] Matched patterns: ${ruleNames}`);
      return;
    }

    if (this.strategy === 'block') {
      this.blockWithTripWire(matches, context);
    }
  }

  private redactMessages(messages: MastraDBMessage[]): MastraDBMessage[] {
    return messages.map(msg => {
      if (typeof msg.content === 'string') {
        // At runtime, content may be a plain string even though MastraDBMessage types it as MastraMessageContentV2.
        // Redact the string and preserve the original shape.
        return { ...msg, content: this.redactText(msg.content) } as unknown as MastraDBMessage;
      }
      if (!msg.content || typeof msg.content !== 'object' || !('parts' in msg.content) || !msg.content.parts) {
        return msg;
      }

      const newParts = msg.content.parts.map(part => {
        if (part.type === 'text' && 'text' in part) {
          return { ...part, text: this.redactText((part as { type: 'text'; text: string }).text) };
        }
        return part;
      });

      return {
        ...msg,
        content: { ...msg.content, parts: newParts },
      };
    });
  }

  processInput(args: ProcessInputArgs<RegexFilterTripwireMetadata>): ProcessInputResult | Promise<ProcessInputResult> {
    if (this.phase === 'output') return args.messages;

    const matches = this.findMatchesInMessages(args.messages);

    if (matches.length === 0) return args.messages;

    this.handleMatches(matches, 'content');

    if (this.strategy === 'redact') {
      return this.redactMessages(args.messages);
    }

    return args.messages;
  }

  async processOutputStream(
    args: ProcessOutputStreamArgs<RegexFilterTripwireMetadata>,
  ): Promise<ChunkType | null | undefined> {
    if (this.phase === 'input') return args.part;

    if (args.part.type === 'text-delta' && args.part.payload?.text) {
      const matches = this.findMatches(args.part.payload.text);
      if (matches.length > 0) {
        if (this.strategy === 'block') {
          this.blockWithTripWire(matches, 'streaming content');
        }
        if (this.strategy === 'redact') {
          return { ...args.part, payload: { ...args.part.payload, text: this.redactText(args.part.payload.text) } };
        }
        if (this.strategy === 'warn') {
          const ruleNames = [...new Set(matches.map(m => m.rule))].join(', ');
          console.warn(`[RegexFilterProcessor] Matched streaming patterns: ${ruleNames}`);
        }
      }
    }
    return args.part;
  }

  processOutputResult(args: ProcessOutputResultArgs<RegexFilterTripwireMetadata>): ProcessorMessageResult {
    if (this.phase === 'input') return args.messages;

    const matches = this.findMatchesInMessages(args.messages);

    if (matches.length === 0) return args.messages;

    this.handleMatches(matches, 'content');

    if (this.strategy === 'redact') {
      return this.redactMessages(args.messages);
    }

    return args.messages;
  }
}
