/**
 * Validation for Skills following the Agent Skills specification.
 * @see https://agentskills.io/specification
 *
 * This module uses plain validation functions instead of Zod to avoid
 * version compatibility issues between Zod 3 and Zod 4.
 */

import matter from 'gray-matter';

// =============================================================================
// Constants
// =============================================================================

/**
 * Recommended limits from the Agent Skills spec
 */
export const SKILL_LIMITS = {
  /** Recommended max tokens for instructions */
  MAX_INSTRUCTION_TOKENS: 5000,
  /** Recommended max lines for SKILL.md */
  MAX_INSTRUCTION_LINES: 500,
  /** Max characters for name field */
  MAX_NAME_LENGTH: 64,
  /** Max characters for description field */
  MAX_DESCRIPTION_LENGTH: 1024,
  /** Max characters for compatibility field */
  MAX_COMPATIBILITY_LENGTH: 500,
} as const;

// =============================================================================
// Types
// =============================================================================

/**
 * Skill metadata input type (what users provide)
 */
export interface SkillMetadataInput {
  /** Skill name (1-64 chars, lowercase letters/numbers/hyphens only, must match directory name) */
  name: string;
  /** Description of what the skill does and when to use it (1-1024 characters) */
  description: string;
  /** License for the skill (e.g., "Apache-2.0", "MIT") */
  license?: string;
  /** Environment requirements or compatibility notes (string or object for flexibility) */
  compatibility?: unknown;
  /** Whether this skill should be directly invokable by users. Defaults to true. */
  'user-invocable'?: boolean;
  /** Arbitrary key-value metadata - values can be strings, arrays, objects, etc. */
  metadata?: Record<string, unknown>;
}

/**
 * Skill metadata output type (after validation)
 */
export type SkillMetadataOutput = SkillMetadataInput;

/**
 * Validation result with warnings
 */
export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Field Validators
// =============================================================================

/**
 * Validate skill name according to spec:
 * - 1-64 characters
 * - Lowercase letters, numbers, hyphens only
 * - Must not start or end with hyphen
 * - Must not contain consecutive hyphens
 *
 * @param name - The name to validate
 * @returns Array of error messages (empty if valid)
 */
function validateSkillName(name: unknown): string[] {
  const errors: string[] = [];
  const fieldPath = 'name';

  // Check type
  if (typeof name !== 'string') {
    errors.push(`${fieldPath}: Expected string, received ${typeof name}`);
    return errors;
  }

  // Check not empty
  if (name.length === 0) {
    errors.push(`${fieldPath}: Skill name cannot be empty`);
    return errors;
  }

  // Check max length
  if (name.length > SKILL_LIMITS.MAX_NAME_LENGTH) {
    errors.push(`${fieldPath}: Skill name must be ${SKILL_LIMITS.MAX_NAME_LENGTH} characters or less`);
  }

  // Check allowed characters (lowercase letters, numbers, hyphens only)
  if (!/^[a-z0-9-]+$/.test(name)) {
    errors.push(`${fieldPath}: Skill name must contain only lowercase letters, numbers, and hyphens`);
  }

  // Check not starting or ending with hyphen
  if (name.startsWith('-') || name.endsWith('-')) {
    errors.push(`${fieldPath}: Skill name must not start or end with a hyphen`);
  }

  // Check no consecutive hyphens
  if (name.includes('--')) {
    errors.push(`${fieldPath}: Skill name must not contain consecutive hyphens`);
  }

  return errors;
}

/**
 * Validate skill description according to spec:
 * - 1-1024 characters
 * - Cannot be empty or only whitespace
 *
 * @param description - The description to validate
 * @returns Array of error messages (empty if valid)
 */
function validateSkillDescription(description: unknown): string[] {
  const errors: string[] = [];
  const fieldPath = 'description';

  // Check type
  if (typeof description !== 'string') {
    errors.push(`${fieldPath}: Expected string, received ${typeof description}`);
    return errors;
  }

  // Check not empty
  if (description.length === 0) {
    errors.push(`${fieldPath}: Skill description cannot be empty`);
    return errors;
  }

  // Check max length
  if (description.length > SKILL_LIMITS.MAX_DESCRIPTION_LENGTH) {
    errors.push(`${fieldPath}: Skill description must be ${SKILL_LIMITS.MAX_DESCRIPTION_LENGTH} characters or less`);
  }

  // Check not only whitespace
  if (description.trim().length === 0) {
    errors.push(`${fieldPath}: Skill description cannot be only whitespace`);
  }

  return errors;
}

/**
 * Validate skill license (optional string).
 *
 * @param license - The license to validate
 * @returns Array of error messages (empty if valid)
 */
function validateSkillLicense(license: unknown): string[] {
  const errors: string[] = [];
  const fieldPath = 'license';

  // Optional field - undefined/null is valid
  if (license === undefined || license === null) {
    return errors;
  }

  // If provided, must be string
  if (typeof license !== 'string') {
    errors.push(`${fieldPath}: Expected string, received ${typeof license}`);
  }

  return errors;
}

/**
 * Validate skill compatibility notes (optional).
 * Accepts string or any JSON-serializable value for flexibility with external skills.
 *
 * @param compatibility - The compatibility value to validate
 * @returns Array of error messages (empty if valid)
 */
function validateSkillCompatibility(_compatibility: unknown): string[] {
  // Optional field - any value is allowed (string, object, array, etc.)
  // External skills don't always follow the spec strictly
  return [];
}

/**
 * Validate skill metadata field (optional Record<string, unknown>).
 * Accepts any values (not just strings) for flexibility with external skills.
 *
 * @param metadata - The metadata object to validate
 * @returns Array of error messages (empty if valid)
 */
function validateSkillMetadataField(metadata: unknown): string[] {
  const errors: string[] = [];
  const fieldPath = 'metadata';

  // Optional field - undefined/null is valid
  if (metadata === undefined || metadata === null) {
    return errors;
  }

  // If provided, must be object (but values can be anything)
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    errors.push(`${fieldPath}: Expected object, received ${Array.isArray(metadata) ? 'array' : typeof metadata}`);
    return errors;
  }

  // Allow any values - external skills use arrays, objects, etc.
  return errors;
}

function validateUserInvocable(userInvocable: unknown): string[] {
  if (userInvocable === undefined || typeof userInvocable === 'boolean') return [];
  return [`user-invocable: Expected boolean, received ${typeof userInvocable}`];
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Rough token estimate (words * 1.3)
 * This is a simple heuristic; actual token counts vary by model
 */
function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

/**
 * Count lines in text
 */
function countLines(text: string): number {
  return text.split('\n').length;
}

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validate skill metadata with optional content warnings.
 *
 * @param options.metadata - The skill metadata to validate
 * @param options.directoryName - The directory name (must match skill name)
 * @param options.instructions - Optional instructions content for token/line warnings
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateSkillMetadata({
 *   metadata: { name: 'my-skill', description: 'A helpful skill' },
 *   directoryName: 'my-skill',
 *   instructions: '# Instructions\n...',
 * });
 *
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * if (result.warnings.length > 0) {
 *   console.warn('Warnings:', result.warnings);
 * }
 * ```
 */
export function validateSkillMetadata({
  metadata,
  directoryName,
  instructions,
}: {
  metadata: unknown;
  directoryName?: string;
  instructions?: string;
}): SkillValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check that metadata is an object
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    errors.push(
      `Expected object, received ${metadata === null ? 'null' : Array.isArray(metadata) ? 'array' : typeof metadata}`,
    );
    return { valid: false, errors, warnings };
  }

  const data = metadata as Record<string, unknown>;

  // Validate each field
  errors.push(...validateSkillName(data.name));
  errors.push(...validateSkillDescription(data.description));
  errors.push(...validateSkillLicense(data.license));
  errors.push(...validateSkillCompatibility(data.compatibility));
  errors.push(...validateUserInvocable(data['user-invocable']));
  errors.push(...validateSkillMetadataField(data.metadata));

  // Check directory name match (only if no name errors and name is valid)
  if (directoryName && typeof data.name === 'string' && data.name !== directoryName) {
    errors.push(`Skill name "${data.name}" must match directory name "${directoryName}"`);
  }

  // Check instruction limits (warnings only)
  if (instructions) {
    const lineCount = countLines(instructions);
    const tokenEstimate = estimateTokens(instructions);

    if (lineCount > SKILL_LIMITS.MAX_INSTRUCTION_LINES) {
      warnings.push(
        `Instructions have ${lineCount} lines (recommended: <${SKILL_LIMITS.MAX_INSTRUCTION_LINES}). Consider moving content to references/.`,
      );
    }

    if (tokenEstimate > SKILL_LIMITS.MAX_INSTRUCTION_TOKENS) {
      warnings.push(
        `Instructions have ~${tokenEstimate} estimated tokens (recommended: <${SKILL_LIMITS.MAX_INSTRUCTION_TOKENS}). Consider moving content to references/.`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Result of validating raw SKILL.md content
 */
export interface SkillContentValidationResult extends SkillValidationResult {
  /** Raw parsed frontmatter fields (present when frontmatter could be parsed; may be invalid) */
  metadata?: Record<string, unknown>;
  /** Markdown body after the frontmatter, trimmed */
  instructions?: string;
}

/**
 * Parse SKILL.md content into frontmatter fields and body.
 * Throws if the frontmatter is not valid YAML.
 * @internal
 */
export function extractSkillFrontmatter(content: string): { metadata: SkillMetadataInput; instructions: string } {
  const parsed = matter(content);
  const data = parsed.data;
  return {
    metadata: {
      name: data.name,
      description: data.description,
      license: data.license,
      compatibility: data.compatibility,
      'user-invocable': data['user-invocable'],
      metadata: data.metadata,
    },
    instructions: parsed.content.trim(),
  };
}

/**
 * Validate raw SKILL.md content (frontmatter + body) using the same rules
 * applied when skills are loaded. Pure: no filesystem access or logging.
 *
 * @param options.content - Full SKILL.md file content
 * @param options.directoryName - Name of the directory the skill will live in (name must match)
 *
 * @example
 * ```typescript
 * const result = validateSkillContent({ content: skillMd, directoryName: 'my-skill' });
 * if (!result.valid) throw new Error(result.errors.join('\n'));
 * ```
 */
export function validateSkillContent({
  content,
  directoryName,
}: {
  content: string;
  directoryName?: string;
}): SkillContentValidationResult {
  let extracted: ReturnType<typeof extractSkillFrontmatter>;
  try {
    extracted = extractSkillFrontmatter(content);
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid frontmatter: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
    };
  }
  return {
    ...validateSkillMetadata({
      metadata: extracted.metadata,
      directoryName,
      instructions: extracted.instructions,
    }),
    metadata: { ...extracted.metadata },
    instructions: extracted.instructions,
  };
}
