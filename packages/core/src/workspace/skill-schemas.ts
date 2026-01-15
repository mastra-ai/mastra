/**
 * Validation schemas for Skills following the Agent Skills specification.
 * @see https://agentskills.io/specification
 */

import z from 'zod';

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
// Zod Schemas
// =============================================================================

/**
 * Skill name schema according to spec:
 * - 1-64 characters
 * - Lowercase letters, numbers, hyphens only
 * - Must not start or end with hyphen
 * - Must not contain consecutive hyphens
 */
export const SkillNameSchema = z
  .string()
  .min(1, 'Skill name cannot be empty')
  .max(SKILL_LIMITS.MAX_NAME_LENGTH, `Skill name must be ${SKILL_LIMITS.MAX_NAME_LENGTH} characters or less`)
  .regex(/^[a-z0-9-]+$/, 'Skill name must contain only lowercase letters, numbers, and hyphens')
  .refine(name => !name.startsWith('-') && !name.endsWith('-'), {
    message: 'Skill name must not start or end with a hyphen',
  })
  .refine(name => !name.includes('--'), {
    message: 'Skill name must not contain consecutive hyphens',
  })
  .describe('Skill name (1-64 chars, lowercase letters/numbers/hyphens only, must match directory name)');

/**
 * Skill description schema according to spec (1-1024 chars, non-empty)
 */
export const SkillDescriptionSchema = z
  .string()
  .min(1, 'Skill description cannot be empty')
  .max(
    SKILL_LIMITS.MAX_DESCRIPTION_LENGTH,
    `Skill description must be ${SKILL_LIMITS.MAX_DESCRIPTION_LENGTH} characters or less`,
  )
  .refine(desc => desc.trim().length > 0, {
    message: 'Skill description cannot be only whitespace',
  })
  .describe('Description of what the skill does and when to use it (1-1024 characters)');

/**
 * Skill compatibility schema (max 500 chars)
 */
export const SkillCompatibilitySchema = z
  .string()
  .max(
    SKILL_LIMITS.MAX_COMPATIBILITY_LENGTH,
    `Compatibility field must be ${SKILL_LIMITS.MAX_COMPATIBILITY_LENGTH} characters or less`,
  )
  .optional()
  .describe('Environment requirements or compatibility notes (max 500 chars)');

/**
 * Skill license schema
 */
export const SkillLicenseSchema = z.string().optional().describe('License for the skill (e.g., "Apache-2.0", "MIT")');

/**
 * Skill metadata (arbitrary key-value pairs) schema
 */
export const SkillMetadataFieldSchema = z
  .record(z.string())
  .optional()
  .describe('Arbitrary key-value metadata (e.g., author, version)');

/**
 * Allowed tools schema (experimental)
 */
export const SkillAllowedToolsSchema = z
  .array(z.string())
  .optional()
  .describe('Pre-approved tools the skill may use (experimental)');

/**
 * Complete skill metadata schema (frontmatter fields)
 */
export const SkillMetadataSchema = z.object({
  name: SkillNameSchema,
  description: SkillDescriptionSchema,
  license: SkillLicenseSchema,
  compatibility: SkillCompatibilitySchema,
  metadata: SkillMetadataFieldSchema,
  allowedTools: SkillAllowedToolsSchema,
});

/**
 * Type inferred from SkillMetadataSchema
 */
export type SkillMetadataInput = z.input<typeof SkillMetadataSchema>;
export type SkillMetadataOutput = z.output<typeof SkillMetadataSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validation result with warnings
 */
export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

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

/**
 * Validate skill metadata with optional content warnings.
 *
 * @param metadata - The skill metadata to validate
 * @param dirName - The directory name (must match skill name)
 * @param instructions - Optional instructions content for token/line warnings
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateSkillMetadata(
 *   { name: 'my-skill', description: 'A helpful skill' },
 *   'my-skill',
 *   '# Instructions\n...'
 * );
 *
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * if (result.warnings.length > 0) {
 *   console.warn('Warnings:', result.warnings);
 * }
 * ```
 */
export function validateSkillMetadata(
  metadata: unknown,
  dirName?: string,
  instructions?: string,
): SkillValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate against schema
  const result = SkillMetadataSchema.safeParse(metadata);
  if (!result.success) {
    errors.push(...result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`));
  }

  // Check directory name match
  if (dirName && result.success && result.data.name !== dirName) {
    errors.push(`Skill name "${result.data.name}" must match directory name "${dirName}"`);
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
 * Parse allowed-tools from YAML (space-delimited string) to array.
 * The Agent Skills spec allows allowed-tools to be specified as a
 * space-delimited string in YAML frontmatter.
 *
 * @param value - The value from YAML (string or array)
 * @returns Array of tool names, or undefined if invalid
 *
 * @example
 * ```typescript
 * // From YAML: allowed-tools: "tool1 tool2 tool3"
 * parseAllowedTools("tool1 tool2 tool3");
 * // Returns: ["tool1", "tool2", "tool3"]
 *
 * // From YAML array: allowed-tools: ["tool1", "tool2"]
 * parseAllowedTools(["tool1", "tool2"]);
 * // Returns: ["tool1", "tool2"]
 * ```
 */
export function parseAllowedTools(value: unknown): string[] | undefined {
  if (typeof value === 'string') {
    return value.split(/\s+/).filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return undefined;
}
