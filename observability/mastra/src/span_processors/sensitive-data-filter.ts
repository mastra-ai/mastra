import { createHash } from 'node:crypto';
import type { SpanOutputProcessor, AnySpan } from '@mastra/core/observability';

export type RedactionStyle = 'full' | 'partial' | 'indexed';

/**
 * Per-trace state for indexed redaction: maps SHA-256 digests of values to
 * their assigned tokens and tracks the next index per token label.
 * Keying on fixed-length digests keeps state size bounded and avoids
 * retaining raw sensitive values in memory.
 */
interface IndexedRedactionState {
  tokensByValue: Map<string, string>;
  counters: Map<string, number>;
}

/**
 * Maximum number of traces to keep indexed-redaction state for.
 * Spans never signal trace completion, so state is evicted least-recently-used.
 */
const MAX_TRACKED_TRACES = 1000;

/**
 * Maximum number of unique values tracked per trace for indexed redaction.
 * Once reached, new values fall back to the full redaction token while
 * already-tracked values keep their assigned tokens.
 */
const MAX_TRACKED_VALUES_PER_TRACE = 1000;

/**
 * Options for configuring the SensitiveDataFilter.
 */
export interface SensitiveDataFilterOptions {
  /**
   * List of sensitive field names to redact.
   * Matching is case-insensitive and normalizes separators (`api-key`, `api_key`, `Api Key` → `apikey`).
   *
   * Defaults include: password, token, secret, key, apikey, auth, authorization,
   * bearer, bearertoken, jwt, credential, clientsecret, privatekey, refresh, ssn.
   */
  sensitiveFields?: string[];

  /**
   * The token used for full redaction.
   * Default: "[REDACTED]"
   */
  redactionToken?: string;

  /**
   * Style of redaction to use:
   * - "full": always replace with redactionToken.
   * - "partial": show 3 characters from the start and end, redact the middle.
   * - "indexed": replace each unique value with a stable token derived from the
   *   matched field name, e.g. `[APIKEY_1]`. The same value maps to the same
   *   token across the spans of a trace while the trace's mapping is retained,
   *   so redacted values stay correlatable without exposing the raw value.
   *   Mapping is scoped per trace and bounded: state is kept for the 1000 most
   *   recently used traces, and each trace tracks up to 1000 unique values
   *   (further new values fall back to the full redaction token).
   *
   * Default: "full"
   */
  redactionStyle?: RedactionStyle;
}

/**
 * SensitiveDataFilter
 *
 * An SpanOutputProcessor that redacts sensitive information from span fields.
 *
 * - Sensitive keys are matched case-insensitively, normalized to remove separators.
 * - Sensitive values are redacted using full, partial, or indexed redaction.
 * - Partial redaction always keeps 3 chars at the start and end.
 * - Indexed redaction assigns each unique value a stable `[LABEL_N]` token,
 *   consistent across all spans of a trace.
 * - JSON strings containing sensitive fields are parsed and redacted.
 * - If filtering a field fails, the field is replaced with:
 *   `{ error: { processor: "sensitive-data-filter" } }`
 */
export class SensitiveDataFilter implements SpanOutputProcessor {
  name = 'sensitive-data-filter';
  private sensitiveFields: string[];
  private redactionToken: string;
  private redactionStyle: RedactionStyle;
  private traceStates = new Map<string, IndexedRedactionState>();

  constructor(options: SensitiveDataFilterOptions = {}) {
    this.sensitiveFields = (
      options.sensitiveFields || [
        'password',
        'token',
        'secret',
        'key',
        'apikey',
        'auth',
        'authorization',
        'bearer',
        'bearertoken',
        'jwt',
        'credential',
        'clientsecret',
        'privatekey',
        'refresh',
        'ssn',
      ]
    ).map(f => this.normalizeKey(f));

    this.redactionToken = options.redactionToken ?? '[REDACTED]';
    this.redactionStyle = options.redactionStyle ?? 'full';
  }

  /**
   * Process a span by filtering sensitive data across its key fields.
   * Fields processed: attributes, metadata, input, output, errorInfo.
   *
   * @param span - The input span to filter
   * @returns A new span with sensitive values redacted
   */
  process(span: AnySpan): AnySpan {
    const indexedState = this.redactionStyle === 'indexed' ? this.getTraceState(span.traceId) : undefined;
    span.attributes = this.tryFilter(span.attributes, indexedState);
    span.metadata = this.tryFilter(span.metadata, indexedState);
    span.input = this.tryFilter(span.input, indexedState);
    span.output = this.tryFilter(span.output, indexedState);
    span.errorInfo = this.tryFilter(span.errorInfo, indexedState);
    return span;
  }

  /**
   * Get (or create) the indexed-redaction state for a trace.
   * Uses the Map's insertion order as an LRU: accessed traces are re-inserted,
   * and the least recently used trace is evicted once the cap is exceeded.
   */
  private getTraceState(traceId: string): IndexedRedactionState {
    let state = this.traceStates.get(traceId);
    if (state) {
      this.traceStates.delete(traceId);
    } else {
      state = { tokensByValue: new Map(), counters: new Map() };
    }
    this.traceStates.set(traceId, state);
    while (this.traceStates.size > MAX_TRACKED_TRACES) {
      const oldest = this.traceStates.keys().next().value;
      if (oldest === undefined) break;
      this.traceStates.delete(oldest);
    }
    return state;
  }

  /**
   * Recursively filter objects/arrays for sensitive keys.
   * Handles circular references by replacing with a marker.
   * Also attempts to parse and redact JSON strings.
   */
  private deepFilter(obj: any, seen = new WeakSet(), indexedState?: IndexedRedactionState): any {
    if (obj === null || typeof obj !== 'object') {
      // Handle string values - check if they contain JSON that needs redacting
      if (typeof obj === 'string') {
        // Quick check - JSON objects/arrays start with { or [
        const trimmed = obj.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          return this.redactJsonString(obj, indexedState);
        }
      }
      return obj;
    }

    if (seen.has(obj)) {
      return '[Circular Reference]';
    }
    seen.add(obj);

    // Preserve Date objects - they have no enumerable keys
    // and Object.keys() returns [], which would incorrectly convert them to {}
    if (obj instanceof Date) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepFilter(item, seen, indexedState));
    }

    const filtered: any = {};
    for (const key of Object.keys(obj)) {
      const normKey = this.normalizeKey(key);

      if (this.isSensitive(normKey)) {
        if (obj[key] && typeof obj[key] === 'object') {
          filtered[key] = this.deepFilter(obj[key], seen, indexedState);
        } else {
          filtered[key] = this.redactValue(obj[key], normKey, indexedState);
        }
      } else {
        filtered[key] = this.deepFilter(obj[key], seen, indexedState);
      }
    }

    return filtered;
  }

  private tryFilter(value: any, indexedState?: IndexedRedactionState): any {
    try {
      return this.deepFilter(value, new WeakSet(), indexedState);
    } catch {
      return { error: { processor: this.name } };
    }
  }

  /**
   * Normalize keys by lowercasing and stripping non-alphanumeric characters.
   * Ensures consistent matching for variants like "api-key", "api_key", "Api Key".
   */
  private normalizeKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Check whether a normalized key exactly matches any sensitive field.
   * Both key and sensitive fields are normalized by removing all non-alphanumeric
   * characters and converting to lowercase before comparison.
   *
   * Examples:
   * - "api_key", "api-key", "ApiKey" all normalize to "apikey" → MATCHES "apikey"
   * - "promptTokens", "prompt_tokens" normalize to "prompttokens" → DOES NOT MATCH "token"
   */
  private isSensitive(normalizedKey: string): boolean {
    return this.sensitiveFields.some(sensitiveField => {
      // Simple case-insensitive match after normalization
      return normalizedKey === sensitiveField;
    });
  }

  /**
   * Attempt to parse a string as JSON and redact sensitive fields within it.
   * If parsing fails or no sensitive data is found, returns the original string.
   */
  private redactJsonString(str: string, indexedState?: IndexedRedactionState): string {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(str);

      // If it's an object, filter it and serialize back
      if (parsed && typeof parsed === 'object') {
        const filtered = this.deepFilter(parsed, new WeakSet(), indexedState);
        return JSON.stringify(filtered);
      }

      // If not an object, return original
      return str;
    } catch {
      // Not valid JSON, return original string
      return str;
    }
  }

  /**
   * Redact a sensitive value.
   * - Full style: replaces with a fixed token.
   * - Partial style: shows 3 chars at start and end, hides the middle.
   * - Indexed style: replaces with a stable `[LABEL_N]` token, where the label
   *   comes from the normalized field name and the same value always maps to
   *   the same token within a trace.
   *
   * Non-string values are converted to strings before partial or indexed redaction.
   */
  private redactValue(value: any, normKey: string, indexedState?: IndexedRedactionState): string {
    if (this.redactionStyle === 'partial') {
      const str = String(value);
      const len = str.length;
      if (len <= 6) {
        return this.redactionToken; // too short, redact fully
      }
      return str.slice(0, 3) + '…' + str.slice(len - 3);
    }

    if (this.redactionStyle === 'indexed' && indexedState) {
      const valueKey = createHash('sha256').update(String(value)).digest('hex');
      const existing = indexedState.tokensByValue.get(valueKey);
      if (existing) {
        return existing;
      }
      if (indexedState.tokensByValue.size >= MAX_TRACKED_VALUES_PER_TRACE) {
        return this.redactionToken;
      }
      const label = normKey.toUpperCase();
      const count = (indexedState.counters.get(label) ?? 0) + 1;
      indexedState.counters.set(label, count);
      const token = `[${label}_${count}]`;
      indexedState.tokensByValue.set(valueKey, token);
      return token;
    }

    return this.redactionToken;
  }

  async shutdown(): Promise<void> {
    this.traceStates.clear();
  }
}
