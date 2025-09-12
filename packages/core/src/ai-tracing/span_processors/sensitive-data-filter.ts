import type { AISpanProcessor, AnyAISpan } from '../types';

export class SensitiveDataFilter implements AISpanProcessor {
  name = 'sensitive-data-filter';
  private sensitiveFields: string[];

  constructor(sensitiveFields?: string[]) {
    // Default sensitive fields with case-insensitive matching
    this.sensitiveFields = (
      sensitiveFields || [
        'password',
        'token',
        'secret',
        'key',
        'apiKey',
        'auth',
        'authorization',
        'bearer',
        'jwt',
        'credential',
        'sessionId',
      ]
    ).map(field => field.toLowerCase());
  }

  process(span: AnyAISpan): AnyAISpan | null {
    // Deep filter function to recursively handle nested objects
    const deepFilter = (obj: any, seen = new WeakSet()): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      // Handle circular references
      if (seen.has(obj)) {
        return '[Circular Reference]';
      }
      seen.add(obj);

      if (Array.isArray(obj)) {
        return obj.map(item => deepFilter(item, seen));
      }

      const filtered: any = {};
      Object.keys(obj).forEach(key => {
        if (this.sensitiveFields.includes(key.toLowerCase())) {
          // Only redact primitive values, recurse into objects/arrays
          if (obj[key] && typeof obj[key] === 'object') {
            filtered[key] = deepFilter(obj[key], seen);
          } else {
            filtered[key] = '[REDACTED]';
          }
        } else {
          filtered[key] = deepFilter(obj[key], seen);
        }
      });

      return filtered;
    };

    try {
      // Create a copy of the span with filtered attributes
      const filteredSpan = { ...span };
      filteredSpan.attributes = deepFilter(span.attributes);
      filteredSpan.metadata = deepFilter(span.metadata);
      filteredSpan.input = deepFilter(span.input);
      filteredSpan.output = deepFilter(span.output);
      filteredSpan.errorInfo = deepFilter(span.errorInfo);
      return filteredSpan;
    } catch {
      // If filtering fails, return heavily redacted span for security
      const safeSpan = { ...span };
      safeSpan.attributes = {
        '[FILTERING_ERROR]': 'Attributes were completely redacted due to filtering error',
      } as any;
      return safeSpan;
    }
  }

  async shutdown(): Promise<void> {
    // No cleanup needed
  }
}
