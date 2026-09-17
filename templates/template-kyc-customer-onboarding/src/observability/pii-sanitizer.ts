import type { AnySpan, SpanOutputProcessor } from '@mastra/core/observability';

export const observabilityRedactionToken = '[PII_REDACTED]';

const sensitiveKeys = new Set(
  [
    'fullName',
    'firstName',
    'lastName',
    'middleName',
    'aliases',
    'alias',
    'maidenName',
    'dateOfBirth',
    'birthDate',
    'birthPlace',
    'dob',
    'email',
    'phone',
    'correlationId',
    'residentialAddress',
    'address',
    'streetLine',
    'streetLine1',
    'streetLine2',
    'line1',
    'line2',
    'city',
    'region',
    'country',
    'postalCode',
    'documentNumber',
    'nationalId',
    'governmentId',
    'taxId',
    'passportNumber',
    'document',
    'documentBytes',
    'bytes',
    'originalValue',
    'normalizedValue',
    'evidenceText',
    'caption',
    'rawPayload',
    'providerPayload',
    'note',
    'safeNote',
    'freeText',
    'body',
  ].map(key => key.replaceAll(/[^a-z0-9]/giu, '').toLowerCase()),
);

const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const phone = /(?<!\d)\+?\d[\d ()-]{7,}\d(?!\d)/gu;
const governmentNumber = /\b(?:\d{3}-\d{2}-\d{4}|[A-Z]{1,3}-?\d{5,12})\b/giu;
const canary = /\bPII[_-]CANARY[_-][A-Z0-9_-]+\b/giu;

const normalizedKey = (key: string): string => key.replaceAll(/[^a-z0-9]/giu, '').toLowerCase();

const sensitiveKeyFragments = [
  'alias',
  'birthdate',
  'dateofbirth',
  'nationalid',
  'governmentid',
  'passportnumber',
  'streetline',
] as const;

const isSensitiveKey = (key: string): boolean => {
  const normalized = normalizedKey(key);
  return sensitiveKeys.has(normalized) || sensitiveKeyFragments.some(fragment => normalized.includes(fragment));
};

const sanitizeString = (value: string): string =>
  value
    .replaceAll(email, observabilityRedactionToken)
    .replaceAll(phone, observabilityRedactionToken)
    .replaceAll(governmentNumber, observabilityRedactionToken)
    .replaceAll(canary, observabilityRedactionToken);

export const sanitizeObservabilityValue = (value: unknown, key?: string, seen = new WeakSet<object>()): unknown => {
  if (key !== undefined && isSensitiveKey(key)) return observabilityRedactionToken;
  if (typeof value === 'string') return sanitizeString(value);
  if (value === null || typeof value !== 'object') return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return observabilityRedactionToken;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map(item => sanitizeObservabilityValue(item, undefined, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeObservabilityValue(entryValue, entryKey, seen),
    ]),
  );
};

export class KycDomainPiiSanitizer implements SpanOutputProcessor {
  readonly name = 'kyc-domain-pii-sanitizer';

  process(span: AnySpan): AnySpan {
    const requestContext = (span as { requestContext?: unknown }).requestContext;
    if (span.attributes !== undefined) {
      (span as { attributes: unknown }).attributes = sanitizeObservabilityValue(span.attributes);
    }
    if (span.metadata !== undefined) {
      (span as { metadata: unknown }).metadata = sanitizeObservabilityValue(span.metadata);
    }
    if (span.input !== undefined) {
      (span as { input: unknown }).input = sanitizeObservabilityValue(span.input);
    }
    if (span.output !== undefined) {
      (span as { output: unknown }).output = sanitizeObservabilityValue(span.output);
    }
    if (span.errorInfo !== undefined) {
      (span as { errorInfo: unknown }).errorInfo = sanitizeObservabilityValue(span.errorInfo);
    }
    if (requestContext !== undefined) {
      (span as unknown as { requestContext: unknown }).requestContext = sanitizeObservabilityValue(requestContext);
    }
    return span;
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
