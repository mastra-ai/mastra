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
import { selectMessagesToCheck } from './message-selection';
import type { LastMessageOnlyOption } from './message-selection';
import {
  deoverlapPIIDetections,
  detectPIIWithPatterns,
  LLM_ONLY_PII_TYPES,
  PII_PATTERNS,
  PII_REGEX_CARRYOVER_SIZE,
  redactPIIValue,
  REGEX_DETECTABLE_PII_TYPES,
} from './pii-shared';
import type { PIIDetection, PIIRedactionMethod, PIIRedactionOptions, RegexDetectablePIIType } from './pii-shared';

/**
 * Metadata attached to the TripWire when PIIRedactor blocks.
 * Never includes the matched values.
 */
export interface PIIRedactorTripwireMetadata {
  processorId: 'pii-redactor';
  detectedTypes: string[];
  detectionCount: number;
  strategy: 'block';
}

/**
 * Configuration options for PIIRedactor
 */
export interface PIIRedactorOptions extends LastMessageOnlyOption {
  /**
   * PII types to detect. Only regex-detectable types are accepted.
   * Context-dependent types (name, address, date-of-birth) require the
   * LLM-based PIIDetector instead.
   */
  detectionTypes: RegexDetectablePIIType[];

  /**
   * Strategy when PII is detected:
   * - 'block': Reject the content with a TripWire error
   * - 'warn': Log a warning but allow content through
   * - 'filter': Remove flagged messages but continue with remaining
   * - 'redact': Replace detected PII with redacted versions (default)
   */
  strategy?: 'block' | 'warn' | 'filter' | 'redact';

  /**
   * Redaction method for PII (default: 'mask'):
   * - 'mask': Replace with asterisks (***@***.com)
   * - 'hash': Replace with SHA256 hash
   * - 'remove': Remove entirely
   * - 'placeholder': Replace with type placeholder ([EMAIL], [PHONE], etc.)
   */
  redactionMethod?: PIIRedactionMethod;

  /**
   * Whether to preserve PII format during redaction (default: true)
   * When true, maintains structure like ***-**-1234 for phone numbers
   */
  preserveFormat?: boolean;
}

/**
 * PIIRedactor detects and redacts pattern-shaped PII using regex only.
 * No LLM calls are made and no agent is constructed, so message content
 * never leaves the process through this processor.
 *
 * For context-dependent PII (names, addresses, dates of birth), use the
 * LLM-based PIIDetector instead.
 *
 * @example Redact emails and phone numbers:
 * ```typescript
 * new PIIRedactor({
 *   detectionTypes: ['email', 'phone', 'credit-card'],
 *   strategy: 'redact',
 *   redactionMethod: 'mask',
 * })
 * ```
 */
export class PIIRedactor implements Processor<'pii-redactor', PIIRedactorTripwireMetadata> {
  public readonly id = 'pii-redactor' as const;
  public readonly name = 'PII Redactor';

  private detectionTypes: RegexDetectablePIIType[];
  private strategy: 'block' | 'warn' | 'filter' | 'redact';
  private redactionOptions: PIIRedactionOptions;
  private lastMessageOnly: boolean;

  /**
   * Create a PIIRedactor.
   *
   * @throws If `detectionTypes` is empty, or contains a type that regex cannot
   * detect (context-dependent types such as name, address, and date-of-birth).
   */
  constructor(options: PIIRedactorOptions) {
    if (!options.detectionTypes || options.detectionTypes.length === 0) {
      throw new Error('PIIRedactor requires at least one detection type');
    }

    for (const type of options.detectionTypes) {
      if (!PII_PATTERNS[type]) {
        const reason = LLM_ONLY_PII_TYPES.has(type)
          ? `"${type}" requires LLM-based detection; use PIIDetector with a model instead`
          : `"${type}" is not a regex-detectable PII type`;
        throw new Error(`PIIRedactor: ${reason}. Supported types: ${REGEX_DETECTABLE_PII_TYPES.join(', ')}`);
      }
    }

    this.detectionTypes = options.detectionTypes;
    this.strategy = options.strategy ?? 'redact';
    this.redactionOptions = {
      method: options.redactionMethod ?? 'mask',
      preserveFormat: options.preserveFormat ?? true,
    };
    this.lastMessageOnly = options.lastMessageOnly ?? false;
  }

  /**
   * Scan incoming user messages and apply the configured strategy.
   */
  processInput(args: ProcessInputArgs<PIIRedactorTripwireMetadata>): ProcessInputResult | Promise<ProcessInputResult> {
    return this.processMessages(args.messages, 'input');
  }

  /**
   * Scan the completed agent response and apply the configured strategy.
   */
  processOutputResult(args: ProcessOutputResultArgs<PIIRedactorTripwireMetadata>): ProcessorMessageResult {
    return this.processMessages(args.messages, 'output');
  }

  /**
   * Process streaming text chunks. A tail of recent characters is carried
   * over between chunks so PII split across chunk boundaries is still
   * detected; only the portion inside the current chunk can be rewritten.
   */
  async processOutputStream(
    args: ProcessOutputStreamArgs<PIIRedactorTripwireMetadata>,
  ): Promise<ChunkType | null | undefined> {
    const { part, state } = args;

    if (part.type !== 'text-delta' || !part.payload?.text) {
      return part;
    }

    const tail = (state._piiRedactorTail as string | undefined) ?? '';
    const combined = tail + part.payload.text;
    const result = detectPIIWithPatterns(combined, this.detectionTypes);
    state._piiRedactorTail = combined.slice(-PII_REGEX_CARRYOVER_SIZE);

    // Only act on detections that overlap the new chunk; tail-only
    // detections were already handled when their chunk was processed.
    const newDetections = (result.detections ?? []).filter(d => d.end > tail.length);
    if (newDetections.length === 0) {
      return part;
    }

    switch (this.strategy) {
      case 'block':
        this.blockWithTripWire(newDetections, 'streaming content');
        return null;

      case 'warn':
        console.warn(`[PIIRedactor] PII detected in streaming content: ${this.uniqueTypes(newDetections).join(', ')}`);
        return part;

      case 'filter':
        console.info(`[PIIRedactor] Filtered streaming part with PII: ${this.uniqueTypes(newDetections).join(', ')}`);
        return null;

      case 'redact':
        return {
          ...part,
          payload: { ...part.payload, text: this.redactNewRegion(combined, tail.length, newDetections) },
        };

      default:
        return part;
    }
  }

  /**
   * Detect PII across the selected messages and apply the configured strategy.
   * `context` only labels the location ('input' or 'output') in warnings and
   * TripWire messages. Returns the original array when nothing is detected.
   */
  private processMessages(messages: MastraDBMessage[], context: string): MastraDBMessage[] {
    if (messages.length === 0) {
      return messages;
    }

    const messagesToCheck = selectMessagesToCheck(messages, this.lastMessageOnly);
    const checkedMessageIds = new Set(messagesToCheck.map(message => message.id));

    const flaggedMessageIds = new Set<string>();
    const allDetections: PIIDetection[] = [];
    for (const message of messages) {
      if (!checkedMessageIds.has(message.id)) continue;
      const detections = this.detectInMessage(message);
      if (detections.length > 0) {
        flaggedMessageIds.add(message.id);
        allDetections.push(...detections);
      }
    }

    if (allDetections.length === 0) {
      return messages;
    }

    switch (this.strategy) {
      case 'block':
        this.blockWithTripWire(allDetections, context);
        return messages;

      case 'warn':
        console.warn(`[PIIRedactor] PII detected: ${this.uniqueTypes(allDetections).join(', ')}`);
        return messages;

      case 'filter':
        console.info(`[PIIRedactor] Filtered ${flaggedMessageIds.size} message(s) with PII`);
        return messages.filter(message => !flaggedMessageIds.has(message.id));

      case 'redact':
        return messages.map(message => (flaggedMessageIds.has(message.id) ? this.redactMessage(message) : message));

      default:
        return messages;
    }
  }

  /**
   * Collect PII detections from every text segment of a single message.
   */
  private detectInMessage(message: MastraDBMessage): PIIDetection[] {
    const detections: PIIDetection[] = [];
    for (const segment of this.extractSegments(message)) {
      detections.push(...(detectPIIWithPatterns(segment, this.detectionTypes).detections ?? []));
    }
    return detections;
  }

  /**
   * Pull the scannable text out of a message: a plain string content, each
   * text part, and the flattened `content.content`. Non-text parts are ignored.
   *
   * `content.content` is scanned even when text parts exist, because
   * `redactMessage` rewrites it in that case too. Skipping it here would let a
   * flattened string that carries PII the parts don't go undetected, which
   * leaves the message unflagged and untouched under every strategy. It is
   * skipped only when a part already covers the exact same text, so the normal
   * case does not report the same detection twice.
   */
  private extractSegments(message: MastraDBMessage): string[] {
    // At runtime, content may be a plain string even though MastraDBMessage types it as MastraMessageContentV2
    if (typeof message.content === 'string') {
      return [message.content];
    }
    const segments: string[] = [];
    if (message.content?.parts) {
      for (const part of message.content.parts) {
        if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
          segments.push(part.text);
        }
      }
    }
    const flattened = message.content?.content;
    if (typeof flattened === 'string' && !segments.includes(flattened)) {
      segments.push(flattened);
    }
    return segments;
  }

  /**
   * Return a copy of the message with PII redacted in every text location,
   * keeping non-text parts and all other message fields untouched.
   */
  private redactMessage(message: MastraDBMessage): MastraDBMessage {
    if (typeof message.content === 'string') {
      return { ...message, content: this.redactText(message.content) } as unknown as MastraDBMessage;
    }
    if (!message.content?.parts) {
      if (typeof message.content?.content === 'string') {
        return { ...message, content: { ...message.content, content: this.redactText(message.content.content) } };
      }
      return message;
    }

    const newParts = message.content.parts.map(part => {
      if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
        return { ...part, text: this.redactText(part.text) };
      }
      return part;
    });

    const newContent: MastraDBMessage['content'] = { ...message.content, parts: newParts };
    if (typeof message.content.content === 'string') {
      newContent.content = this.redactText(message.content.content);
    }

    return { ...message, content: newContent };
  }

  /**
   * Apply the configured redaction method to one string, returning it
   * unchanged when no PII is found.
   */
  private redactText(text: string): string {
    const result = detectPIIWithPatterns(text, this.detectionTypes, this.redactionOptions);
    return result.redacted_content ?? text;
  }

  /**
   * Rewrite only the region of `combined` past `tailLength`, replacing the
   * in-chunk portion of each detection. Avoids re-redacting tail content
   * that was already emitted, which would shift slice offsets.
   */
  private redactNewRegion(combined: string, tailLength: number, detections: PIIDetection[]): string {
    const sorted = deoverlapPIIDetections(detections);
    let cursor = tailLength;
    let out = '';
    for (const detection of sorted) {
      const start = Math.max(detection.start, tailLength);
      if (start > cursor) {
        out += combined.slice(cursor, start);
      }
      if (detection.end > cursor) {
        out += redactPIIValue(detection.value, detection.type, this.redactionOptions);
        cursor = detection.end;
      }
    }
    if (cursor < combined.length) {
      out += combined.slice(cursor);
    }
    return out;
  }

  /**
   * List the distinct PII types present in a detection set. Used for logs and
   * TripWire metadata, which never carry the matched values.
   */
  private uniqueTypes(detections: PIIDetection[]): string[] {
    return [...new Set(detections.map(d => d.type))];
  }

  /**
   * Abort processing for the 'block' strategy.
   *
   * @throws A non-retryable {@link TripWire} carrying the detected types and
   * count, but never the matched values.
   */
  private blockWithTripWire(detections: PIIDetection[], context: string): never {
    const detectedTypes = this.uniqueTypes(detections);
    throw new TripWire<PIIRedactorTripwireMetadata>(`PII detected in ${context}. Types: ${detectedTypes.join(', ')}`, {
      retry: false,
      metadata: {
        processorId: this.id,
        detectedTypes,
        detectionCount: detections.length,
        strategy: 'block',
      },
    });
  }
}
