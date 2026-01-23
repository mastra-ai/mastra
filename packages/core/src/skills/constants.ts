/**
 * Constants for the skills system
 */

/**
 * Standard filename for skill definition
 */
export const SKILL_FILE_NAME = 'SKILL.md';

/**
 * Optional skill subdirectories
 */
export const SKILL_SUBDIRS = {
  SCRIPTS: 'scripts',
  EXAMPLES: 'examples',
  RESOURCES: 'resources',
} as const;

/**
 * Error codes for skill operations
 */
export const SKILL_ERROR_CODES = {
  // File system errors
  FILE_NOT_FOUND: 'SKILL_FILE_NOT_FOUND',
  DIRECTORY_NOT_FOUND: 'SKILL_DIRECTORY_NOT_FOUND',
  READ_ERROR: 'SKILL_READ_ERROR',

  // Parsing errors
  INVALID_FRONTMATTER: 'SKILL_INVALID_FRONTMATTER',
  MISSING_FRONTMATTER: 'SKILL_MISSING_FRONTMATTER',
  PARSE_ERROR: 'SKILL_PARSE_ERROR',

  // Validation errors
  MISSING_NAME: 'SKILL_MISSING_NAME',
  MISSING_DESCRIPTION: 'SKILL_MISSING_DESCRIPTION',
  INVALID_NAME_FORMAT: 'SKILL_INVALID_NAME_FORMAT',
  EMPTY_INSTRUCTIONS: 'SKILL_EMPTY_INSTRUCTIONS',

  // Cache errors
  CACHE_ERROR: 'SKILL_CACHE_ERROR',

  // General errors
  UNKNOWN_ERROR: 'SKILL_UNKNOWN_ERROR',
} as const;

/**
 * Warning codes for skill operations
 */
export const SKILL_WARNING_CODES = {
  MISSING_VERSION: 'SKILL_MISSING_VERSION',
  MISSING_TAGS: 'SKILL_MISSING_TAGS',
  NO_EXAMPLES: 'SKILL_NO_EXAMPLES',
  NO_SCRIPTS: 'SKILL_NO_SCRIPTS',
  LARGE_FILE: 'SKILL_LARGE_FILE',
} as const;

/**
 * Default options for skill loading
 */
export const DEFAULT_LOAD_OPTIONS = {
  validate: true,
  computeHash: false,
} as const;

/**
 * Maximum recommended file size for SKILL.md (in bytes)
 * 100KB - skills larger than this will trigger a warning
 */
export const MAX_RECOMMENDED_FILE_SIZE = 100 * 1024;

/**
 * Regex for valid skill names
 * Must be lowercase alphanumeric with hyphens, no spaces
 * Examples: "code-review", "doc-gen", "ui-ux-pro"
 */
export const SKILL_NAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
