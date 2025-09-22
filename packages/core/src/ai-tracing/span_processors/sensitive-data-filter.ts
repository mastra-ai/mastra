import type { AISpanProcessor, AnyAISpan } from '../types';

export type RedactionStyle = 'full' | 'partial';

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
   *
   * Default: "full"
   */
  redactionStyle?: RedactionStyle;
}

/**
 * SensitiveDataFilter
 *
 * An AISpanProcessor that redacts sensitive information from span fields.
 *
 * - Sensitive keys are matched case-insensitively, normalized to remove separators.
 * - Sensitive values are redacted using either full or partial redaction.
 * - Partial redaction always keeps 3 chars at the start and end.
 * - If filtering a field fails, the field is replaced with:
 *   `{ error: { processor: "sensitive-data-filter" } }`
 */
export class SensitiveDataFilter implements AISpanProcessor {
  name = 'sensitive-data-filter';
  private sensitiveFields: string[];
  private redactionToken: string;
  private redactionStyle: RedactionStyle;

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
  process(span: AnyAISpan): AnyAISpan {
    span.attributes = this.tryFilter(span.attributes);
    span.metadata = this.tryFilter(span.metadata);
    span.input = this.tryFilter(span.input);
    span.output = this.tryFilter(span.output);
    span.errorInfo = this.tryFilter(span.errorInfo);
    return span;
  }

  /**
   * Recursively filter objects/arrays for sensitive keys.
   * Handles circular references by replacing with a marker.
   */
  private deepFilter(obj: any, seen = new WeakSet()): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (seen.has(obj)) {
      return '[Circular Reference]';
    }
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepFilter(item, seen));
    }

    const filtered: any = {};
    for (const key of Object.keys(obj)) {
      const normKey = this.normalizeKey(key);

      if (this.isSensitive(normKey)) {
        if (obj[key] && typeof obj[key] === 'object') {
          filtered[key] = this.deepFilter(obj[key], seen);
        } else {
          filtered[key] = this.redactValue(obj[key]);
        }
      } else {
        filtered[key] = this.deepFilter(obj[key], seen);
      }
    }

    return filtered;
  }

  private tryFilter(value: any): any {
    try {
      return this.deepFilter(value);
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
   * Redact a sensitive value.
   * - Full style: replaces with a fixed token.
   * - Partial style: shows 3 chars at start and end, hides the middle.
   *
   * Non-string values are converted to strings before partial redaction.
   */
  private redactValue(value: any): string {
    if (this.redactionStyle === 'full') {
      return this.redactionToken;
    }

    const str = String(value);
    const len = str.length;
    if (len <= 6) {
      return this.redactionToken; // too short, redact fully
    }
    return str.slice(0, 3) + '…' + str.slice(len - 3);
  }

  async shutdown(): Promise<void> {
    // No cleanup needed
  }
}
