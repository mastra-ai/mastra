import * as crypto from 'node:crypto';

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
 * Individual PII category score
 */
export interface PIICategoryScore {
  type: string;
  score: number;
}

export type PIICategoryScores = PIICategoryScore[];

/**
 * Individual PII detection with location and redaction info
 */
export interface PIIDetection {
  type: string;
  value: string;
  confidence: number;
  start: number;
  end: number;
  redacted_value?: string | null; // Only present when strategy is 'redact'
}

/**
 * Result structure for PII detection (simplified for minimal tokens)
 */
export interface PIIDetectionResult {
  categories: PIICategoryScores | null;
  detections: PIIDetection[] | null;
  redacted_content?: string | null; // Only present when strategy is 'redact'
}

/**
 * Redaction method applied to detected PII values
 */
export type PIIRedactionMethod = 'mask' | 'hash' | 'remove' | 'placeholder';

/** All regex-detectable PII types */
export const REGEX_DETECTABLE_PII_TYPES = [
  'email',
  'phone',
  'credit-card',
  'ssn',
  'api-key',
  'ip-address',
  'url',
  'uuid',
  'crypto-wallet',
  'iban',
] as const;

/**
 * PII types detectable with regex patterns alone (no LLM required)
 */
export type RegexDetectablePIIType = (typeof REGEX_DETECTABLE_PII_TYPES)[number];

/**
 * Regex patterns for local (zero-cost) PII detection
 */
export const PII_PATTERNS: Record<RegexDetectablePIIType, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(?:\+?\d{1,3}[-.\ ]?)?\(?\d{3}\)?[-.\ ]?\d{3}[-.\ ]?\d{4}/g,
  'credit-card': /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  'api-key':
    /(?:(?:sk|pk)[-_](?:live|test|proj)[-_][A-Za-z0-9]{16,}|(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*["']?[a-zA-Z0-9_\-]{20,}["']?)/gi,
  'ip-address': /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  url: /https?:\/\/[^\s<>"']+/gi,
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  'crypto-wallet': /\b(?:0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})\b/g,
  iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b/g,
};

/** PII types that require LLM context and cannot be detected by regex */
export const LLM_ONLY_PII_TYPES = new Set(['name', 'address', 'date-of-birth']);

/**
 * Number of characters to carry over between chunks for regex detection.
 * Ensures PII split across chunk boundaries (e.g. "test@" + "example.com") is caught.
 */
export const PII_REGEX_CARRYOVER_SIZE = 128;

/**
 * Options controlling how detected PII values are rewritten
 */
export interface PIIRedactionOptions {
  method: PIIRedactionMethod;
  preserveFormat: boolean;
}

/**
 * Redact an individual PII value based on method and type
 */
export function redactPIIValue(value: string, type: string, options: PIIRedactionOptions): string {
  switch (options.method) {
    case 'mask':
      return maskPIIValue(value, type, options.preserveFormat);
    case 'hash':
      return hashPIIValue(value);
    case 'remove':
      return '';
    case 'placeholder':
      return `[${type.toUpperCase()}]`;
    default:
      return maskPIIValue(value, type, options.preserveFormat);
  }
}

/**
 * Mask a PII value while optionally preserving format
 */
export function maskPIIValue(value: string, type: string, preserveFormat: boolean): string {
  if (!preserveFormat) {
    return '*'.repeat(Math.min(value.length, 8));
  }

  switch (type) {
    case 'email': {
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
    }

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
 * Hash a PII value using SHA256
 */
export function hashPIIValue(value: string): string {
  return `[HASH:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 8)}]`;
}

/**
 * Drop detections that overlap an earlier-starting (or same-start, longer) one
 * so span replacement always operates on disjoint ranges. Patterns run
 * independently, so e.g. an email inside a matched URL produces overlapping
 * spans that would garble spliced output.
 */
export function deoverlapPIIDetections(detections: PIIDetection[]): PIIDetection[] {
  const sorted = [...detections].sort((a, b) => a.start - b.start || b.end - a.end);
  const disjoint: PIIDetection[] = [];
  let lastEnd = -1;
  for (const detection of sorted) {
    if (detection.start < lastEnd) continue;
    disjoint.push(detection);
    lastEnd = detection.end;
  }
  return disjoint;
}

/**
 * Apply redaction to content given a set of detections
 */
export function applyPIIRedaction(content: string, detections: PIIDetection[], options: PIIRedactionOptions): string {
  let redacted = content;

  // Sort detections by start position in reverse order to maintain indices
  const sortedDetections = deoverlapPIIDetections(detections).sort((a, b) => b.start - a.start);

  for (const detection of sortedDetections) {
    const redactedValue = redactPIIValue(detection.value, detection.type, options);
    redacted = redacted.slice(0, detection.start) + redactedValue + redacted.slice(detection.end);
  }

  return redacted;
}

/**
 * Detect PII using regex patterns (zero-cost, no LLM calls).
 * Types without a regex pattern (LLM-only or unknown custom types) are skipped.
 * When `redact` options are provided, detections carry a `redacted_value` and
 * the result includes `redacted_content`.
 */
export function detectPIIWithPatterns(
  content: string,
  detectionTypes: string[],
  redact?: PIIRedactionOptions,
): PIIDetectionResult {
  const categories: PIICategoryScores = [];
  const detections: PIIDetection[] = [];

  for (const type of detectionTypes) {
    const pattern = PII_PATTERNS[type as RegexDetectablePIIType];
    if (!pattern) continue;

    // Fresh regex per call so shared /g patterns keep no lastIndex state across runs
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      detections.push({
        type,
        value: match[0],
        confidence: 1.0,
        start: match.index,
        end: match.index + match[0].length,
        ...(redact ? { redacted_value: redactPIIValue(match[0], type, redact) } : {}),
      });
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }
  }

  const disjointDetections = deoverlapPIIDetections(detections);

  const detectedTypes = new Set(disjointDetections.map(d => d.type));
  for (const type of detectedTypes) {
    categories.push({ type, score: 1.0 });
  }

  let redacted_content: string | null | undefined;
  if (redact && disjointDetections.length > 0) {
    redacted_content = applyPIIRedaction(content, disjointDetections, redact);
  } else if (redact) {
    redacted_content = null;
  }

  return {
    categories: categories.length > 0 ? categories : null,
    detections: disjointDetections.length > 0 ? disjointDetections : null,
    ...(redact ? { redacted_content } : {}),
  };
}
