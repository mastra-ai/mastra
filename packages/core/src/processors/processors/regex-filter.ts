import type { MastraDBMessage } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { ChunkType } from '../../stream';
import type {
  ProcessInputArgs,
  ProcessInputResult,
  ProcessOutputResultArgs,
  ProcessOutputStreamArgs,
  ProcessorMessageResult,
  ProcessorViolation,
  Processor,
} from '../index';
import { REPROCESS_PART_KEY } from '../stream-reprocess';

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
 * Internal match that keeps a reference to the originating rule and both
 * offsets. `RegexMatch` only carries the rule name, which is ambiguous when two
 * rules share a name, and no end offset.
 */
interface RuleMatch {
  /** The rule that produced this match */
  rule: RegexRule;
  /** Start offset of the match in the text */
  start: number;
  /** End offset (exclusive) of the match in the text */
  end: number;
}

/**
 * Width of a match in characters, used to pick the winner among overlaps.
 */
function matchLength(match: RuleMatch): number {
  return match.end - match.start;
}

/**
 * Rules are matched with a fresh RegExp each time so a `lastIndex` left over
 * from a previous pass can never skip part of the next text.
 */
function compilePattern(rule: RegexRule): RegExp {
  return new RegExp(rule.pattern.source, rule.pattern.flags);
}

/**
 * A span of text to replace, built by unioning overlapping matches.
 */
interface RedactionRegion {
  /** Start offset of the region in the text */
  start: number;
  /** End offset (exclusive) of the region in the text */
  end: number;
  /** Longest match contributing to this region; supplies the replacement */
  owner: RuleMatch;
  /**
   * Rule names of every match merged into this region, set only once a second
   * match joins. Left undefined for the common one-match region so a region
   * costs no extra allocation.
   */
  overlappingRules?: string[];
}

/**
 * One span of text that the `redact` strategy rewrote.
 */
export interface RegexRedaction {
  /** Name of the rule whose replacement was used */
  rule: string;
  /** Start offset of the redacted span in the text */
  index: number;
  /** Length of the redacted span */
  length: number;
  /** Text that replaced the span */
  replacement: string;
  /** Names of all rules that matched this span, when more than one overlapped */
  overlappingRules?: string[];
  /** The text that was redacted. Only set when `includeRedactedValues` is enabled */
  value?: string;
}

/**
 * `ProcessorViolation.detail` for a redaction. Reports the redactions applied to
 * one piece of text, so the offsets always refer to a single message, message
 * part, or stream chunk.
 */
export interface RegexRedactionDetail {
  strategy: 'redact';
  /** Processor method that applied the redactions */
  phase: 'processInput' | 'processOutputStream' | 'processOutputResult';
  /** Id of the message the text came from. Absent for stream chunks */
  messageId?: string;
  /**
   * Index of the redacted part in the message's `parts` array, which also
   * contains non-text parts. Absent for string content and stream chunks.
   */
  partIndex?: number;
  /** Redactions in the order they appear in the text */
  redactions: RegexRedaction[];
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

  /**
   * Include the text that was redacted in `RegexRedaction.value`.
   *
   * Off by default: the values are the data the processor exists to remove, so
   * an audit trail should not become a second copy of them. Turn it on only
   * when the destination is as protected as the original.
   */
  includeRedactedValues?: boolean;

  /**
   * Trailing characters the streaming redact path holds back between chunks,
   * so a match split across a chunk boundary is redacted whole. Defaults to
   * 128, which covers every built-in preset rule with a wide margin. Raise it
   * for custom rules whose matches stay invisible to the rule until they
   * complete — a fixed-length secret, or a value that only matches once a
   * closing delimiter arrives (e.g. an armored key) — when such a match can
   * be longer than the window. The window must be at least the longest span
   * any such rule can match.
   */
  streamCarryoverSize?: number;
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
 * Default number of trailing characters the streaming redact path holds back
 * between chunks, so a match split across a chunk boundary is redacted whole
 * instead of leaking the part that arrived first. A match is held back while
 * the buffered text still matches its rule, so rules whose partial matches
 * match on their own — every built-in preset with an unbounded length, like
 * bearer tokens, API keys, and URLs — are redacted whole at any match length.
 * A match that stays invisible to its rule until it completes (a fixed-length
 * secret, or a value that only matches once a closing delimiter arrives) is
 * held only while it fits in the window; 128 covers every bounded built-in
 * preset with a wide margin, and `streamCarryoverSize` raises it for longer
 * custom rules.
 */
const STREAM_CARRYOVER_SIZE = 128;

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
  private includeRedactedValues: boolean;
  private streamCarryoverSize: number;

  /**
   * Invoked when the `redact` strategy rewrites a piece of text, once per
   * redacted message, message part, or stream chunk, with a
   * {@link RegexRedactionDetail} as `detail`. The `block` strategy reports
   * through the same callback, driven by the processor runner when it catches
   * the TripWire.
   */
  public onViolation?: (violation: ProcessorViolation) => void | Promise<void>;

  constructor(options: RegexFilterOptions) {
    const presetRules = (options.presets ?? []).flatMap(preset => PRESET_MAP[preset] ?? []);
    this.rules = [...presetRules, ...(options.rules ?? [])];

    if (this.rules.length === 0) {
      throw new Error('RegexFilterProcessor requires at least one rule or preset');
    }

    this.strategy = options.strategy ?? 'block';
    this.phase = options.phase ?? 'all';
    this.includeRedactedValues = options.includeRedactedValues ?? false;
    this.streamCarryoverSize = options.streamCarryoverSize ?? STREAM_CARRYOVER_SIZE;
    if (!Number.isSafeInteger(this.streamCarryoverSize) || this.streamCarryoverSize < 1) {
      throw new Error('RegexFilterProcessor streamCarryoverSize must be a positive safe integer');
    }
  }

  /**
   * Run every rule over the text and collect all matches, grouped by rule in
   * declaration order. Matches may overlap; callers that rewrite text must
   * de-overlap them first.
   */
  private collectMatches(text: string): RuleMatch[] {
    const matches: RuleMatch[] = [];
    for (const rule of this.rules) {
      const regex = compilePattern(rule);
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        matches.push({ rule, start: m.index, end: m.index + m[0].length });
        if (!regex.global) break;
        if (m[0].length === 0) {
          regex.lastIndex++;
        }
      }
    }
    return matches;
  }

  /**
   * Public-shaped view of the matches, used for block and warn reporting.
   */
  private findMatches(text: string): RegexMatch[] {
    return this.collectMatches(text).map(({ rule, start, end }) => ({
      rule: rule.name,
      match: text.slice(start, end),
      index: start,
    }));
  }

  /**
   * Collapses the raw matches into disjoint regions, merging any that overlap.
   * Each rule is matched independently, so two rules can claim intersecting
   * ranges (a bare 16-digit card number matches both `phone` and `credit-card`).
   * Replacing them one rule at a time leaves the tail of the longer match in
   * the clear, so overlapping ranges are unioned and redacted once.
   */
  private buildRedactionRegions(matches: RuleMatch[]): RedactionRegion[] {
    const ordered = matches
      .filter(match => matchLength(match) > 0)
      .sort((a, b) => a.start - b.start || matchLength(b) - matchLength(a));

    const regions: RedactionRegion[] = [];
    for (const match of ordered) {
      const current = regions.at(-1);
      if (current && match.start < current.end) {
        current.end = Math.max(current.end, match.end);
        (current.overlappingRules ??= [current.owner.rule.name]).push(match.rule.name);
        if (matchLength(match) > matchLength(current.owner)) {
          current.owner = match;
        }
      } else {
        regions.push({ start: match.start, end: match.end, owner: match });
      }
    }
    return regions;
  }

  /**
   * Resolve the text that replaces a region.
   *
   * Replacements containing `$` may reference capture groups, so those are
   * resolved by re-running the rule against the matched slice. That requires the
   * pattern to still cover the whole slice on its own, which it will not when the
   * rule is anchored on its surroundings or when its match length depended on
   * text outside the region. A merged region does not correspond to a single
   * pattern at all. Every one of those falls back to the replacement string as
   * written, so the region is replaced whole and no part of it survives.
   */
  private resolveReplacement(text: string, region: RedactionRegion): string {
    const { rule } = region.owner;
    const replacement = rule.replacement ?? '[REDACTED]';
    if (region.overlappingRules || !replacement.includes('$')) return replacement;

    const matched = text.slice(region.start, region.end);
    const isolated = compilePattern(rule).exec(matched);
    if (!isolated || isolated.index !== 0 || isolated[0].length !== matched.length) return replacement;

    return matched.replace(compilePattern(rule), replacement);
  }

  /**
   * Replace every matched region of the text with its rule's replacement, and
   * describe each replacement so callers can report it.
   */
  private redactText(text: string): { text: string; redactions: RegexRedaction[] } {
    return this.redactRegions(text, this.buildRedactionRegions(this.collectMatches(text)));
  }

  /**
   * Apply precomputed regions to the text. The regions must be disjoint, in
   * document order, and contained in the text — exactly what
   * {@link buildRedactionRegions} returns for it.
   */
  private redactRegions(text: string, regions: RedactionRegion[]): { text: string; redactions: RegexRedaction[] } {
    if (regions.length === 0) return { text, redactions: [] };

    const redactions: RegexRedaction[] = [];
    let result = '';
    let cursor = 0;
    for (const region of regions) {
      const replacement = this.resolveReplacement(text, region);
      result += text.slice(cursor, region.start) + replacement;
      cursor = region.end;

      const overlappingRules = region.overlappingRules && [...new Set(region.overlappingRules)];
      redactions.push({
        rule: region.owner.rule.name,
        index: region.start,
        length: region.end - region.start,
        replacement,
        ...(overlappingRules && overlappingRules.length > 1 ? { overlappingRules } : {}),
        ...(this.includeRedactedValues ? { value: text.slice(region.start, region.end) } : {}),
      });
    }
    return { text: result + text.slice(cursor), redactions };
  }

  /**
   * Hand a redaction to `onViolation`, if one is set and anything changed.
   * Returns nothing when there is no callback, so the redact path stays
   * synchronous unless a caller actually attached one.
   */
  private reportRedaction(
    phase: RegexRedactionDetail['phase'],
    redactions: RegexRedaction[],
    location?: { messageId?: string; partIndex?: number },
  ): void | Promise<void> {
    if (!this.onViolation || redactions.length === 0) return;

    const ruleNames = [...new Set(redactions.map(redaction => redaction.rule))].join(', ');
    const detail: RegexRedactionDetail = {
      strategy: 'redact',
      phase,
      ...(location?.messageId !== undefined ? { messageId: location.messageId } : {}),
      ...(location?.partIndex !== undefined ? { partIndex: location.partIndex } : {}),
      redactions,
    };

    try {
      return Promise.resolve(
        this.onViolation({
          processorId: this.id,
          message: `Regex filter: redacted content matching patterns: ${ruleNames}`,
          detail,
        }),
      ).catch(() => {
        // onViolation errors are silently caught
      });
    } catch {
      // onViolation errors are silently caught
    }
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

  /**
   * Redact every text segment of every message, reporting each segment
   * separately so the offsets in a report always refer to one piece of text.
   *
   * Returns the messages directly when nothing is awaiting a report, keeping the
   * common case synchronous, and a promise once `onViolation` is set.
   */
  private redactMessages(
    messages: MastraDBMessage[],
    phase: RegexRedactionDetail['phase'],
  ): MastraDBMessage[] | Promise<MastraDBMessage[]> {
    const pending: Promise<void>[] = [];
    const collect = (report: void | Promise<void>) => {
      if (report) pending.push(report);
    };

    const redactedMessages = messages.map(msg => {
      if (typeof msg.content === 'string') {
        // At runtime, content may be a plain string even though MastraDBMessage types it as MastraMessageContentV2.
        // Redact the string and preserve the original shape.
        const redacted = this.redactText(msg.content);
        collect(this.reportRedaction(phase, redacted.redactions, { messageId: msg.id }));
        return { ...msg, content: redacted.text } as unknown as MastraDBMessage;
      }
      if (!msg.content || typeof msg.content !== 'object' || !('parts' in msg.content) || !msg.content.parts) {
        return msg;
      }

      const newParts = msg.content.parts.map((part, partIndex) => {
        if (part.type === 'text' && 'text' in part) {
          const redacted = this.redactText((part as { type: 'text'; text: string }).text);
          collect(this.reportRedaction(phase, redacted.redactions, { messageId: msg.id, partIndex }));
          return { ...part, text: redacted.text };
        }
        return part;
      });

      return {
        ...msg,
        content: { ...msg.content, parts: newParts },
      };
    });

    if (pending.length === 0) return redactedMessages;
    return Promise.all(pending).then(() => redactedMessages);
  }

  processInput(args: ProcessInputArgs<RegexFilterTripwireMetadata>): ProcessInputResult | Promise<ProcessInputResult> {
    if (this.phase === 'output') return args.messages;

    const matches = this.findMatchesInMessages(args.messages);

    if (matches.length === 0) return args.messages;

    this.handleMatches(matches, 'content');

    if (this.strategy === 'redact') {
      return this.redactMessages(args.messages, 'processInput');
    }

    return args.messages;
  }

  async processOutputStream(
    args: ProcessOutputStreamArgs<RegexFilterTripwireMetadata>,
  ): Promise<ChunkType | null | undefined> {
    if (this.phase === 'input') return args.part;

    const { part, state, writer } = args;

    if (this.strategy === 'redact') {
      return this.redactStreamPart(part, state, writer);
    }

    if (part.type === 'text-delta' && part.payload?.text) {
      const matches = this.findMatches(part.payload.text);
      if (matches.length > 0) {
        if (this.strategy === 'block') {
          this.blockWithTripWire(matches, 'streaming content');
        }
        if (this.strategy === 'warn') {
          const ruleNames = [...new Set(matches.map(m => m.rule))].join(', ');
          console.warn(`[RegexFilterProcessor] Matched streaming patterns: ${ruleNames}`);
        }
      }
    }
    return part;
  }

  /**
   * Streaming redact path with a carryover tail.
   *
   * Matching always runs over the held-back tail of the previous chunks plus
   * the current chunk, and only text that cannot still grow into a match is
   * emitted: the last `streamCarryoverSize` characters stay buffered, and a
   * match crossing that emission boundary pulls it back to the match's start.
   * A secret split across two chunks is therefore redacted whole instead of
   * leaking the part that arrived first. The tail is flushed when a non-text
   * part closes the text run, so concatenating the emitted text deltas yields
   * exactly `redactText` of the full stream text.
   */
  private async redactStreamPart(
    part: ChunkType,
    state: Record<string, unknown>,
    writer: ProcessOutputStreamArgs<RegexFilterTripwireMetadata>['writer'],
  ): Promise<ChunkType | null> {
    // A previous flush deferred a non-text part (direct invocation without a
    // writer): hand it out now and keep the current part for a later call.
    const pending = state._regexFilterPendingNonText as ChunkType | undefined;
    if (pending) {
      if (part.type === 'text-delta') {
        state._regexFilterPendingNonText = undefined;
        if (part.payload?.text) this.appendStreamCarryover(state, part);
      } else {
        state._regexFilterPendingNonText = part;
      }
      return pending;
    }

    if (part.type === 'text-delta') {
      if (!part.payload?.text) return part;

      const combined = this.appendStreamCarryover(state, part);
      if (combined.length <= this.streamCarryoverSize) return null;

      let emitEnd = combined.length - this.streamCarryoverSize;
      const regions = this.buildRedactionRegions(this.collectMatches(combined));
      for (const region of regions) {
        if (region.start < emitEnd && region.end > emitEnd) emitEnd = region.start;
      }

      const emitted = this.redactRegions(
        combined.slice(0, emitEnd),
        regions.filter(region => region.end <= emitEnd),
      );
      state._regexFilterCarryover = combined.slice(emitEnd);
      await this.reportRedaction('processOutputStream', emitted.redactions);
      if (emitted.text.length === 0) return null;
      return { ...part, payload: { ...part.payload, text: emitted.text } };
    }

    // Non-text part: the text run is over, so redact and flush the held-back
    // tail. The triggering part still has to be emitted after the flushed
    // text, but only one part can be returned: stash it for the runner to
    // re-drive through the chain, or defer it to the next call when invoked
    // directly without a writer. A direct caller whose stream ends on that
    // part drains it from `state._regexFilterPendingNonText` — the same
    // fallback BatchPartsProcessor and PIIDetector document.
    const carryover = (state._regexFilterCarryover as string | undefined) ?? '';
    if (!carryover) return part;

    const flushed = this.redactText(carryover);
    await this.reportRedaction('processOutputStream', flushed.redactions);
    const carryoverPart = state._regexFilterCarryoverPart as (ChunkType & { type: 'text-delta' }) | undefined;
    state._regexFilterCarryover = undefined;
    state._regexFilterCarryoverPart = undefined;

    if (writer) {
      state[REPROCESS_PART_KEY] = part;
    } else {
      state._regexFilterPendingNonText = part;
    }
    return { ...carryoverPart!, payload: { ...carryoverPart!.payload, text: flushed.text } };
  }

  /**
   * Append a text delta to the carryover tail, remembering the first part that
   * contributed to it so a flush can reuse its id, runId, and origin.
   */
  private appendStreamCarryover(state: Record<string, unknown>, part: ChunkType & { type: 'text-delta' }): string {
    const previous = (state._regexFilterCarryover as string | undefined) ?? '';
    if (!previous) state._regexFilterCarryoverPart = part;
    const combined = previous + part.payload.text;
    state._regexFilterCarryover = combined;
    return combined;
  }

  processOutputResult(args: ProcessOutputResultArgs<RegexFilterTripwireMetadata>): ProcessorMessageResult {
    if (this.phase === 'input') return args.messages;

    const matches = this.findMatchesInMessages(args.messages);

    if (matches.length === 0) return args.messages;

    this.handleMatches(matches, 'content');

    if (this.strategy === 'redact') {
      return this.redactMessages(args.messages, 'processOutputResult');
    }

    return args.messages;
  }
}
