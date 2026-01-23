import type {
  LoadedSkill,
  LoadSkillOptions,
  SkillValidationError,
  SkillValidationResult,
  SkillValidationWarning,
} from './types';
import { SKILL_ERROR_CODES, SKILL_NAME_REGEX, SKILL_WARNING_CODES, MAX_RECOMMENDED_FILE_SIZE } from './constants';

/**
 * Validates a loaded skill against the Agent Skills standard
 * @param skill The skill to validate
 * @returns Validation result with any errors or warnings
 */
export function validateSkill(skill: LoadedSkill): SkillValidationResult {
  const errors: SkillValidationError[] = [];
  const warnings: SkillValidationWarning[] = [];

  // Validate required fields
  if (!skill.content.frontmatter.name || skill.content.frontmatter.name.trim() === '') {
    errors.push({
      code: SKILL_ERROR_CODES.MISSING_NAME,
      message: 'Skill name is required in frontmatter',
      field: 'name',
    });
  } else {
    // Validate name format
    if (!SKILL_NAME_REGEX.test(skill.content.frontmatter.name)) {
      errors.push({
        code: SKILL_ERROR_CODES.INVALID_NAME_FORMAT,
        message: 'Skill name must be lowercase alphanumeric with hyphens only (e.g., "code-review", "doc-generator")',
        field: 'name',
      });
    }
  }

  if (!skill.content.frontmatter.description || skill.content.frontmatter.description.trim() === '') {
    errors.push({
      code: SKILL_ERROR_CODES.MISSING_DESCRIPTION,
      message: 'Skill description is required in frontmatter',
      field: 'description',
    });
  }

  // Validate instructions content
  if (!skill.content.instructions || skill.content.instructions.trim() === '') {
    errors.push({
      code: SKILL_ERROR_CODES.EMPTY_INSTRUCTIONS,
      message: 'Skill must have instructions content after frontmatter',
      field: 'instructions',
    });
  }

  // Optional field warnings
  if (!skill.content.frontmatter.version) {
    warnings.push({
      code: SKILL_WARNING_CODES.MISSING_VERSION,
      message: 'Consider adding a version field for better skill management',
      field: 'version',
    });
  }

  if (!skill.content.frontmatter.tags || skill.content.frontmatter.tags.length === 0) {
    warnings.push({
      code: SKILL_WARNING_CODES.MISSING_TAGS,
      message: 'Consider adding tags for better skill discovery',
      field: 'tags',
    });
  }

  // File size warning
  if (skill.metadata.fileSize && skill.metadata.fileSize > MAX_RECOMMENDED_FILE_SIZE) {
    warnings.push({
      code: SKILL_WARNING_CODES.LARGE_FILE,
      message: `Skill file is ${Math.round(skill.metadata.fileSize / 1024)}KB (recommended max: ${Math.round(MAX_RECOMMENDED_FILE_SIZE / 1024)}KB). Consider splitting into multiple skills.`,
    });
  }

  // Optional directory warnings
  if (!skill.metadata.examplesPath) {
    warnings.push({
      code: SKILL_WARNING_CODES.NO_EXAMPLES,
      message: 'Consider adding an examples/ folder with usage examples',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates skill options before loading
 * @internal
 */
export function validateLoadOptions(options: LoadSkillOptions): void {
  if (options.basePath && typeof options.basePath !== 'string') {
    throw new Error('basePath must be a string');
  }

  if (options.validate !== undefined && typeof options.validate !== 'boolean') {
    throw new Error('validate option must be a boolean');
  }

  if (options.computeHash !== undefined && typeof options.computeHash !== 'boolean') {
    throw new Error('computeHash option must be a boolean');
  }
}

/**
 * Validates a skill directory structure
 * @param skillPath Path to the skill directory
 * @returns True if the directory appears to be a valid skill directory
 */
export function isValidSkillDirectory(skillPath: string): boolean {
  // Must be a string path
  if (!skillPath || typeof skillPath !== 'string') {
    return false;
  }

  // Cannot be empty after trimming
  if (skillPath.trim() === '') {
    return false;
  }

  return true;
}
