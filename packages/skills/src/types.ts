/**
 * Re-export core types from @mastra/core/skills
 */
export type {
  SkillFormat,
  SkillMetadata,
  Skill,
  SkillSource,
  SkillSearchResult,
  SkillSearchOptions,
  MastraSkills,
  CreateSkillInput,
  UpdateSkillInput,
} from '@mastra/core/skills';

/**
 * Configuration for Skills class
 */
export interface SkillsConfig {
  /** Unique identifier for this skills instance */
  id: string;
  /** Path or paths to directories containing skills */
  paths: string | string[];
  /** Validate skills on load (default: true) */
  validateOnLoad?: boolean;
  /** Watch for file changes (default: false) */
  watchForChanges?: boolean;
}
