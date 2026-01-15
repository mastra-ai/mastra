/**
 * Skills Module
 *
 * Provides types, schemas, and implementation for Skills following the Agent Skills specification.
 * Skills are SKILL.md files discovered from workspace skillsPaths.
 *
 * @see https://github.com/anthropics/skills
 */

// =============================================================================
// Types
// =============================================================================

export type {
  SkillSource,
  SkillFormat,
  SkillMetadata,
  Skill,
  SkillSearchResult,
  SkillSearchOptions,
  CreateSkillInput,
  UpdateSkillInput,
  WorkspaceSkills,
} from './types';

// =============================================================================
// Validation Schemas
// =============================================================================

export {
  SKILL_LIMITS,
  SkillNameSchema,
  SkillDescriptionSchema,
  SkillCompatibilitySchema,
  SkillLicenseSchema,
  SkillMetadataFieldSchema,
  SkillAllowedToolsSchema,
  SkillMetadataSchema,
  validateSkillMetadata,
  parseAllowedTools,
  type SkillMetadataInput,
  type SkillMetadataOutput,
  type SkillValidationResult,
} from './schemas';

// =============================================================================
// Implementation
// =============================================================================

export { WorkspaceSkillsImpl, type WorkspaceSkillsImplConfig } from './workspace-skills';
