/**
 * LLM Contract Validation
 *
 * Validates LLM API response structures against known schemas.
 * Useful for detecting API drift before it breaks production code.
 *
 * The validator compares response _structure_ (types, field presence)
 * rather than exact values, making it resilient to normal response variation.
 *
 * @example
 * ```typescript
 * import { validateLLMContract, extractSchema, formatContractResult } from '@internal/llm-recorder';
 *
 * // Compare actual response against expected structure
 * const result = validateLLMContract(actualResponse, expectedResponse);
 * console.log(formatContractResult(result));
 * ```
 */

import type { LLMRecording } from './llm-recorder';

// Re-export the type for convenience
export type { LLMRecording };

/**
 * Schema representation of a value's structure
 */
export interface SchemaNode {
  type: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  nullable?: boolean;
  example?: string;
}

/**
 * Result of a contract validation
 */
export interface ContractValidationResult {
  valid: boolean;
  differences: ContractDifference[];
}

/**
 * A single difference found during validation
 */
export interface ContractDifference {
  path: string;
  type: 'missing_field' | 'extra_field' | 'type_mismatch' | 'structure_change';
  expected?: string;
  actual?: string;
  message: string;
}

/**
 * Options for contract validation
 */
export interface ContractValidationOptions {
  /** Paths to ignore during comparison (supports glob-like patterns) */
  ignorePaths: string[];
  /** Whether to allow extra fields not in the expected schema */
  allowExtraFields: boolean;
  /** Whether to allow missing fields from the expected schema */
  allowMissingFields: boolean;
  /** Whether to treat null as a valid value for any type */
  treatNullAsOptional: boolean;
}

const DEFAULT_OPTIONS: ContractValidationOptions = {
  ignorePaths: [],
  allowExtraFields: true,
  allowMissingFields: false,
  treatNullAsOptional: true,
};

/**
 * Common dynamic fields in LLM responses that change between requests
 */
export const DEFAULT_IGNORE_PATHS = [
  'id',
  'created',
  'created_at',
  'model',
  'system_fingerprint',
  'usage.*',
  '*.id',
  '*.created',
  '*.index',
  'x-request-id',
  'openai-processing-ms',
  'x-ratelimit-*',
  'cf-*',
  'set-cookie',
  'date',
  'alt-svc',
];

/**
 * Get the type of a value as a string
 */
function getType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Check if a path matches any of the ignore patterns.
 *
 * Supports simple dot-separated path patterns with `*` wildcards:
 * - `*` matches any segment characters (not dots)
 * - `usage.*` matches `usage.input_tokens`, `usage.output_tokens`, etc.
 */
function pathMatches(inputPath: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Reject excessively long patterns to mitigate ReDoS
    if (pattern.length > 200) return false;

    try {
      // Escape regex-special chars (except *), then convert * to a safe character class
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]*');
      return new RegExp(`^${escaped}$`).test(inputPath);
    } catch {
      // Invalid pattern — skip it
      return false;
    }
  });
}

/**
 * Check if a path should be ignored
 */
function shouldIgnore(path: string, options: ContractValidationOptions): boolean {
  const allIgnorePaths = [...DEFAULT_IGNORE_PATHS, ...options.ignorePaths];
  return pathMatches(path, allIgnorePaths);
}

/**
 * Extract a schema from a value
 */
export function extractSchema(value: unknown): SchemaNode {
  const type = getType(value);

  if (type === 'null') {
    return { type: 'null', nullable: true };
  }

  if (type === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const properties: Record<string, SchemaNode> = {};

    for (const [key, val] of Object.entries(obj)) {
      properties[key] = extractSchema(val);
    }

    return { type: 'object', properties };
  }

  if (type === 'array') {
    const arr = value as unknown[];
    if (arr.length > 0) {
      return { type: 'array', items: extractSchema(arr[0]) };
    }
    return { type: 'array' };
  }

  // Primitive types
  const example = String(value);
  return {
    type,
    example: example.length > 50 ? example.slice(0, 50) + '...' : example,
  };
}

/**
 * Compare two schemas and collect differences
 */
function compareSchemas(
  expected: SchemaNode,
  actual: SchemaNode,
  currentPath: string,
  options: ContractValidationOptions,
  differences: ContractDifference[],
): void {
  if (shouldIgnore(currentPath, options)) {
    return;
  }

  // Type mismatch (allowing null if treatNullAsOptional)
  if (expected.type !== actual.type) {
    if (options.treatNullAsOptional && (actual.type === 'null' || expected.type === 'null')) {
      return;
    }

    differences.push({
      path: currentPath || '(root)',
      type: 'type_mismatch',
      expected: expected.type,
      actual: actual.type,
      message: `Type changed from ${expected.type} to ${actual.type}`,
    });
    return;
  }

  // Compare object properties
  if (expected.type === 'object' && expected.properties && actual.properties) {
    // Check for missing fields
    if (!options.allowMissingFields) {
      for (const key of Object.keys(expected.properties)) {
        const fieldPath = currentPath ? `${currentPath}.${key}` : key;
        if (shouldIgnore(fieldPath, options)) continue;

        if (!(key in actual.properties)) {
          differences.push({
            path: fieldPath,
            type: 'missing_field',
            expected: expected.properties[key]?.type,
            message: `Field "${key}" is missing (expected type: ${expected.properties[key]?.type})`,
          });
        }
      }
    }

    // Check for extra fields
    if (!options.allowExtraFields) {
      for (const key of Object.keys(actual.properties)) {
        const fieldPath = currentPath ? `${currentPath}.${key}` : key;
        if (shouldIgnore(fieldPath, options)) continue;

        if (!(key in expected.properties)) {
          differences.push({
            path: fieldPath,
            type: 'extra_field',
            actual: actual.properties[key]?.type,
            message: `Unexpected field "${key}" (type: ${actual.properties[key]?.type})`,
          });
        }
      }
    }

    // Recursively compare common fields
    for (const key of Object.keys(expected.properties)) {
      if (key in (actual.properties || {})) {
        const fieldPath = currentPath ? `${currentPath}.${key}` : key;
        compareSchemas(expected.properties[key]!, actual.properties![key]!, fieldPath, options, differences);
      }
    }
  }

  // Compare array items
  if (expected.type === 'array' && expected.items) {
    if (actual.items) {
      compareSchemas(expected.items, actual.items, `${currentPath}[]`, options, differences);
    } else {
      differences.push({
        path: `${currentPath}[]`,
        type: 'missing_field',
        expected: expected.items.type,
        message: `Array items schema is missing (expected item type: ${expected.items.type})`,
      });
    }
  }
}

/**
 * Validate an actual LLM response against an expected response structure
 */
export function validateLLMContract(
  actual: unknown,
  expected: unknown,
  options: Partial<ContractValidationOptions> = {},
): ContractValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const differences: ContractDifference[] = [];

  const actualSchema = extractSchema(actual);
  const expectedSchema = extractSchema(expected);

  compareSchemas(expectedSchema, actualSchema, '', opts, differences);

  return {
    valid: differences.length === 0,
    differences,
  };
}

/**
 * Format validation result for display
 */
export function formatContractResult(result: ContractValidationResult): string {
  if (result.valid) {
    return '✓ Contract validation passed';
  }

  const lines = ['✗ Contract validation failed:', ''];

  for (const diff of result.differences) {
    const icon =
      diff.type === 'missing_field'
        ? '−'
        : diff.type === 'extra_field'
          ? '+'
          : diff.type === 'type_mismatch'
            ? '≠'
            : '?';

    lines.push(`  ${icon} ${diff.path}: ${diff.message}`);
    if (diff.expected) lines.push(`      expected: ${diff.expected}`);
    if (diff.actual) lines.push(`      actual: ${diff.actual}`);
  }

  return lines.join('\n');
}

/**
 * Compare streaming chunks structure
 */
export function validateStreamingContract(
  actualChunks: string[],
  expectedChunks: string[],
  options: Partial<ContractValidationOptions> = {},
): ContractValidationResult {
  const differences: ContractDifference[] = [];

  // Parse SSE events from chunks
  const parseEvents = (chunks: string[]): Array<{ event: string; data: unknown }> => {
    const events: Array<{ event: string; data: unknown }> = [];
    for (const chunk of chunks) {
      const lines = chunk.split('\n');
      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7);
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            events.push({ event: currentEvent, data });
          } catch {
            // Skip non-JSON data
          }
        }
      }
    }
    return events;
  };

  const actualEvents = parseEvents(actualChunks);
  const expectedEvents = parseEvents(expectedChunks);

  // Compare event types sequence
  const actualEventTypes = actualEvents.map(e => e.event);
  const expectedEventTypes = expectedEvents.map(e => e.event);

  // Check that key events are present (order may vary slightly)
  const requiredEvents = ['response.created', 'response.completed'];
  for (const eventType of requiredEvents) {
    if (expectedEventTypes.includes(eventType) && !actualEventTypes.includes(eventType)) {
      differences.push({
        path: `events.${eventType}`,
        type: 'missing_field',
        expected: eventType,
        message: `Required event "${eventType}" is missing`,
      });
    }
  }

  // Compare schema of key events
  for (const eventType of requiredEvents) {
    const expectedEvent = expectedEvents.find(e => e.event === eventType);
    const actualEvent = actualEvents.find(e => e.event === eventType);

    if (expectedEvent && actualEvent) {
      const result = validateLLMContract(actualEvent.data, expectedEvent.data, options);
      for (const diff of result.differences) {
        differences.push({
          ...diff,
          path: `events.${eventType}.${diff.path}`,
        });
      }
    }
  }

  return {
    valid: differences.length === 0,
    differences,
  };
}
