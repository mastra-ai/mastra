// Public API exports for the skills module

export { SkillsManager } from './manager';
export { loadSkill, loadSkills, validateSkillDirectory } from './loader';
export { validateSkill, isValidSkillDirectory } from './validator';

export type {
    SkillFrontmatter,
    SkillContent,
    SkillMetadata,
    LoadedSkill,
    SkillPathInput,
    LoadSkillOptions,
    SkillValidationResult,
    SkillValidationError,
    SkillValidationWarning,
} from './types';

export { SkillError } from './types';

export {
    SKILL_FILE_NAME,
    SKILL_SUBDIRS,
    SKILL_ERROR_CODES,
    SKILL_WARNING_CODES,
    SKILL_NAME_REGEX,
    MAX_RECOMMENDED_FILE_SIZE,
} from './constants';
