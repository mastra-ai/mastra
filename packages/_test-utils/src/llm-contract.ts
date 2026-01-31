/**
 * LLM Contract Validation
 *
 * Compares the structure/schema of LLM responses without comparing exact values.
 * Used for nightly tests to detect API changes/drift.
 *
 * @example
 * ```typescript
 * import { validateLLMContract, extractSchema } from '@mastra/core/test-utils';
 *
 * // In nightly contract test
 * it('OpenAI response structure matches recording', async () => {
 *   const liveResponse = await agent.generate('Hello');
 *   const recording = loadRecording('my-tests');
 *
 *   const result = validateLLMContract(liveResponse, recording.response.body);
 *   expect(result.valid).toBe(true);
 *   if (!result.valid) {
 *     console.log('Schema drift detected:', result.differences);
 *   }
 * });
 * ```
 */

/**
 * Schema node representing the structure of a value
 */
export interface SchemaNode {
  type: 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';
  /** For objects: map of key -> schema */
  properties?: Record<string, SchemaNode>;
  /** For arrays: schema of items (from first non-null item) */
  items?: SchemaNode;
  /** Whether this field was null/undefined in the sample */
  nullable?: boolean;
  /** Example value (for primitives, truncated) */
  example?: string;
}

/**
 * Result of contract validation
 */
export interface ContractValidationResult {
  valid: boolean;
  differences: ContractDifference[];
}

/**
 * A single difference between expected and actual schema
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
  /**
   * Paths to ignore during comparison (supports wildcards)
   * @example ['response.id', 'response.created_at', 'output.*.content.*.text']
   */
  ignorePaths?: string[];

  /**
   * Allow extra fields in actual that aren't in expected
   * (API additions are usually non-breaking)
   * @default true
   */
  allowExtraFields?: boolean;

  /**
   * Allow missing fields in actual that were in expected
   * (Usually indicates a breaking change)
   * @default false
   */
  allowMissingFields?: boolean;

  /**
   * Treat null and undefined as equivalent
   * @default true
   */
  treatNullAsOptional?: boolean;
}

const DEFAULT_OPTIONS: ContractValidationOptions = {
  ignorePaths: [],
  allowExtraFields: true,
  allowMissingFields: false,
  treatNullAsOptional: true,
};

/**
 * Default paths to ignore for LLM responses (always dynamic)
 */
export const DEFAULT_IGNORE_PATHS = [
  // IDs and timestamps
  'id',
  '*.id',
  'created_at',
  'completed_at',
  'timestamp',
  '*.created_at',
  '*.completed_at',

  // Request-specific
  'x-request-id',
  'cf-ray',
  'date',
  'set-cookie',

  // Content that varies
  'output.*.content.*.text',
  'text',
  'delta',
  'obfuscation',

  // Usage varies
  'usage.input_tokens',
  'usage.output_tokens',
  'usage.total_tokens',
  'usage.*.cached_tokens',

  // Processing time varies
  'openai-processing-ms',
];

/**
 * Get the type of a value for schema purposes
 */
function getType(value: unknown): SchemaNode['type'] {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return t;
  if (t === 'object') return 'object';
  return 'string'; // fallback
}

/**
 * Extract a schema from a value
 */
export function extractSchema(value: unknown, maxExampleLength = 50): SchemaNode {
  const type = getType(value);

  if (type === 'null') {
    return { type: 'null', nullable: true };
  }

  if (type === 'array') {
    const arr = value as unknown[];
    // Get schema from first non-null item
    const firstItem = arr.find(item => item !== null && item !== undefined);
    return {
      type: 'array',
      items: firstItem !== undefined ? extractSchema(firstItem, maxExampleLength) : undefined,
    };
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    const properties: Record<string, SchemaNode> = {};
    for (const [key, val] of Object.entries(obj)) {
      properties[key] = extractSchema(val, maxExampleLength);
    }
    return { type: 'object', properties };
  }

  // Primitive
  let example = String(value);
  if (example.length > maxExampleLength) {
    example = example.slice(0, maxExampleLength) + '...';
  }
  return { type, example };
}

/**
 * Check if a path matches a pattern (supports * wildcard)
 */
function pathMatches(path: string, pattern: string): boolean {
  const pathParts = path.split('.');
  const patternParts = pattern.split('.');

  if (patternParts.length > pathParts.length) return false;

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === '*') continue;
    if (patternParts[i] !== pathParts[i]) return false;
  }

  return true;
}

/**
 * Check if a path should be ignored
 */
function shouldIgnore(path: string, ignorePaths: string[]): boolean {
  return ignorePaths.some(pattern => pathMatches(path, pattern));
}

/**
 * Compare two schemas and find differences
 */
function compareSchemas(
  expected: SchemaNode,
  actual: SchemaNode,
  path: string,
  options: ContractValidationOptions,
  differences: ContractDifference[],
): void {
  const ignorePaths = [...(options.ignorePaths || []), ...DEFAULT_IGNORE_PATHS];

  if (shouldIgnore(path, ignorePaths)) {
    return;
  }

  // Handle null/optional
  if (options.treatNullAsOptional) {
    if (expected.type === 'null' || actual.type === 'null') {
      return; // Treat as compatible
    }
  }

  // Type mismatch
  if (expected.type !== actual.type) {
    differences.push({
      path,
      type: 'type_mismatch',
      expected: expected.type,
      actual: actual.type,
      message: `Type changed from ${expected.type} to ${actual.type}`,
    });
    return;
  }

  // Compare objects
  if (expected.type === 'object' && actual.type === 'object') {
    const expectedProps = expected.properties || {};
    const actualProps = actual.properties || {};

    // Check for missing fields
    if (!options.allowMissingFields) {
      for (const key of Object.keys(expectedProps)) {
        const fieldPath = path ? `${path}.${key}` : key;
        if (shouldIgnore(fieldPath, ignorePaths)) continue;

        if (!(key in actualProps)) {
          differences.push({
            path: fieldPath,
            type: 'missing_field',
            expected: expectedProps[key]!.type,
            message: `Field "${key}" was removed`,
          });
        }
      }
    }

    // Check for extra fields
    if (!options.allowExtraFields) {
      for (const key of Object.keys(actualProps)) {
        const fieldPath = path ? `${path}.${key}` : key;
        if (shouldIgnore(fieldPath, ignorePaths)) continue;

        if (!(key in expectedProps)) {
          differences.push({
            path: fieldPath,
            type: 'extra_field',
            actual: actualProps[key]!.type,
            message: `New field "${key}" was added`,
          });
        }
      }
    }

    // Recursively compare shared fields
    for (const key of Object.keys(expectedProps)) {
      if (key in actualProps) {
        const fieldPath = path ? `${path}.${key}` : key;
        compareSchemas(expectedProps[key]!, actualProps[key]!, fieldPath, options, differences);
      }
    }
  }

  // Compare arrays
  if (expected.type === 'array' && actual.type === 'array') {
    if (expected.items && actual.items) {
      compareSchemas(expected.items, actual.items, `${path}[]`, options, differences);
    }
  }
}

/**
 * Validate that an actual LLM response matches the expected contract/schema
 *
 * @param actual - The actual response from a live API call
 * @param expected - The expected response (from a recording)
 * @param options - Validation options
 * @returns Validation result with any differences found
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
