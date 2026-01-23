/**
 * YAML frontmatter structure for SKILL.md files
 * Follows the Agent Skills standard format (https://agentskills.io)
 */
export interface SkillFrontmatter {
  /**
   * Unique identifier for the skill (lowercase, hyphens for spaces)
   * @example "code-review", "documentation-generator"
   */
  name: string;

  /**
   * Clear description of what this skill does and when to use it
   * This helps the agent understand when to apply the skill
   */
  description: string;

  /**
   * Optional semantic version of the skill
   * @example "1.0.0"
   */
  version?: string;

  /**
   * Optional author or organization name
   * @example "Mastra AI", "John Doe"
   */
  author?: string;

  /**
   * Optional tags for categorization and discovery
   * @example ["coding", "review", "quality"]
   */
  tags?: string[];

  /**
   * Optional list of skill dependencies (by name)
   * @example ["base-coding-skill"]
   */
  dependencies?: string[];

  /**
   * Optional keywords for skill matching and discovery
   * @example ["code", "review", "lint", "quality"]
   */
  keywords?: string[];
}

/**
 * Parsed content of a skill after loading
 */
export interface SkillContent {
  /**
   * Parsed YAML frontmatter from SKILL.md
   */
  frontmatter: SkillFrontmatter;

  /**
   * Markdown instructions content (everything after frontmatter)
   * This is what gets injected into agent instructions
   */
  instructions: string;

  /**
   * Full raw content of SKILL.md file
   */
  rawContent: string;
}

/**
 * Metadata about a loaded skill
 */
export interface SkillMetadata {
  /**
   * Timestamp when the skill was loaded
   */
  loadedAt: Date;

  /**
   * Hash of the SKILL.md file for cache invalidation
   * Computed from file content for detecting changes
   */
  fileHash?: string;

  /**
   * Absolute path to scripts/ folder if it exists
   */
  scriptsPath?: string;

  /**
   * Absolute path to examples/ folder if it exists
   */
  examplesPath?: string;

  /**
   * Absolute path to resources/ folder if it exists
   */
  resourcesPath?: string;

  /**
   * Size of SKILL.md file in bytes
   */
  fileSize?: number;
}

/**
 * A completely loaded skill with all metadata
 */
export interface LoadedSkill {
  /**
   * Unique identifier derived from frontmatter.name or folder name
   */
  id: string;

  /**
   * Absolute path to the skill folder
   */
  path: string;

  /**
   * Parsed skill content
   */
  content: SkillContent;

  /**
   * Additional metadata about the skill
   */
  metadata: SkillMetadata;
}

/**
 * Input format for skill paths
 * Can be a single path string or array of paths
 */
export type SkillPathInput = string | string[];

/**
 * Options for loading skills
 */
export interface LoadSkillOptions {
  /**
   * Whether to validate the skill after loading
   * @default true
   */
  validate?: boolean;

  /**
   * Whether to compute file hash for cache invalidation
   * @default false
   */
  computeHash?: boolean;

  /**
   * Base path for resolving relative skill paths
   * Defaults to process.cwd()
   */
  basePath?: string;
}

/**
 * Validation result for a skill
 */
export interface SkillValidationResult {
  /**
   * Whether the skill is valid
   */
  valid: boolean;

  /**
   * Validation errors if any
   */
  errors: SkillValidationError[];

  /**
   * Validation warnings (non-blocking)
   */
  warnings: SkillValidationWarning[];
}

/**
 * Validation error
 */
export interface SkillValidationError {
  /**
   * Error code for programmatic handling
   */
  code: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Optional field that caused the error
   */
  field?: string;
}

/**
 * Validation warning
 */
export interface SkillValidationWarning {
  /**
   * Warning code for programmatic handling
   */
  code: string;

  /**
   * Human-readable warning message
   */
  message: string;

  /**
   * Optional field that caused the warning
   */
  field?: string;
}

/**
 * Error thrown by skills system
 */
export class SkillError extends Error {
  constructor(
    message: string,
    public code: string,
    public skillPath?: string,
  ) {
    super(message);
    this.name = 'SkillError';
  }
}
