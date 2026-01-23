import { readFile, stat, access } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import type { LoadedSkill, LoadSkillOptions, SkillContent, SkillFrontmatter, SkillMetadata } from './types';
import { SkillError } from './types';
import {
    SKILL_FILE_NAME,
    SKILL_SUBDIRS,
    SKILL_ERROR_CODES,
    DEFAULT_LOAD_OPTIONS,
} from './constants';
import { validateSkill, validateLoadOptions, isValidSkillDirectory } from './validator';

/**
 * Loads a single skill from a directory path
 * @param skillPath Path to the skill directory (relative or absolute)
 * @param options Loading options
 * @returns Loaded skill with all metadata
 *
 * @example
 * ```typescript
 * const skill = await loadSkill('.mastra/skills/code-review');
 * console.log(skill.content.frontmatter.name); // "code-review"
 * ```
 */
export async function loadSkill(skillPath: string, options: LoadSkillOptions = {}): Promise<LoadedSkill> {
    // Merge with default options
    const opts = { ...DEFAULT_LOAD_OPTIONS, ...options };

    // Validate options
    validateLoadOptions(opts);

    // Validate skill path
    if (!isValidSkillDirectory(skillPath)) {
        throw new SkillError(
            `Invalid skill path: "${skillPath}"`,
            SKILL_ERROR_CODES.DIRECTORY_NOT_FOUND,
            skillPath,
        );
    }

    // Resolve absolute path
    const basePath = opts.basePath || process.cwd();
    const absoluteSkillPath = isAbsolute(skillPath) ? skillPath : resolve(basePath, skillPath);

    // Check if directory exists
    try {
        const dirStat = await stat(absoluteSkillPath);
        if (!dirStat.isDirectory()) {
            throw new SkillError(
                `Skill path is not a directory: "${absoluteSkillPath}"`,
                SKILL_ERROR_CODES.DIRECTORY_NOT_FOUND,
                skillPath,
            );
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new SkillError(
                `Skill directory not found: "${absoluteSkillPath}"`,
                SKILL_ERROR_CODES.DIRECTORY_NOT_FOUND,
                skillPath,
            );
        }
        throw error;
    }

    // Load SKILL.md file
    const skillFilePath = join(absoluteSkillPath, SKILL_FILE_NAME);
    let rawContent: string;
    let fileStats;

    try {
        fileStats = await stat(skillFilePath);
        rawContent = await readFile(skillFilePath, 'utf-8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new SkillError(
                `${SKILL_FILE_NAME} not found in skill directory: "${absoluteSkillPath}"`,
                SKILL_ERROR_CODES.FILE_NOT_FOUND,
                skillPath,
            );
        }
        throw new SkillError(
            `Failed to read ${SKILL_FILE_NAME}: ${(error as Error).message}`,
            SKILL_ERROR_CODES.READ_ERROR,
            skillPath,
        );
    }

    // Parse frontmatter
    let parsed: matter.GrayMatterFile<string>;
    try {
        parsed = matter(rawContent);
    } catch (error) {
        throw new SkillError(
            `Failed to parse YAML frontmatter in ${SKILL_FILE_NAME}: ${(error as Error).message}`,
            SKILL_ERROR_CODES.PARSE_ERROR,
            skillPath,
        );
    }

    // Validate frontmatter exists
    if (!parsed.data || Object.keys(parsed.data).length === 0) {
        throw new SkillError(
            `${SKILL_FILE_NAME} must have YAML frontmatter with at least 'name' and 'description' fields`,
            SKILL_ERROR_CODES.MISSING_FRONTMATTER,
            skillPath,
        );
    }

    // Build skill content
    const frontmatter = parsed.data as SkillFrontmatter;
    const instructions = parsed.content.trim();

    const content: SkillContent = {
        frontmatter,
        instructions,
        rawContent,
    };

    // Build metadata
    const metadata: SkillMetadata = {
        loadedAt: new Date(),
        fileSize: fileStats.size,
    };

    // Compute file hash if requested
    if (opts.computeHash) {
        metadata.fileHash = createHash('sha256').update(rawContent).digest('hex');
    }

    // Check for optional subdirectories
    const scriptsPath = join(absoluteSkillPath, SKILL_SUBDIRS.SCRIPTS);
    const examplesPath = join(absoluteSkillPath, SKILL_SUBDIRS.EXAMPLES);
    const resourcesPath = join(absoluteSkillPath, SKILL_SUBDIRS.RESOURCES);

    try {
        await access(scriptsPath);
        metadata.scriptsPath = scriptsPath;
    } catch {
        // No scripts folder - this is optional
    }

    try {
        await access(examplesPath);
        metadata.examplesPath = examplesPath;
    } catch {
        // No examples folder - this is optional
    }

    try {
        await access(resourcesPath);
        metadata.resourcesPath = resourcesPath;
    } catch {
        // No resources folder - this is optional
    }

    // Construct loaded skill
    const skill: LoadedSkill = {
        id: frontmatter.name || absoluteSkillPath.split(/[/\\]/).pop() || 'unknown',
        path: absoluteSkillPath,
        content,
        metadata,
    };

    // Validate skill if requested
    if (opts.validate) {
        const validationResult = validateSkill(skill);
        if (!validationResult.valid) {
            const errorMessages = validationResult.errors.map(e => `  - ${e.message}`).join('\n');
            throw new SkillError(
                `Skill validation failed for "${skillPath}":\n${errorMessages}`,
                SKILL_ERROR_CODES.INVALID_FRONTMATTER,
                skillPath,
            );
        }
    }

    return skill;
}

/**
 * Loads multiple skills from an array of paths
 * @param skillPaths Array of paths to skill directories
 * @param options Loading options
 * @returns Map of skill ID to loaded skill
 *
 * @example
 * ```typescript
 * const skills = await loadSkills([
 *   '.mastra/skills/code-review',
 *   '.mastra/skills/documentation'
 * ]);
 * console.log(skills.size); // 2
 * ```
 */
export async function loadSkills(
    skillPaths: string[],
    options: LoadSkillOptions = {},
): Promise<Map<string, LoadedSkill>> {
    const skillsMap = new Map<string, LoadedSkill>();
    const errors: Array<{ path: string; error: Error }> = [];

    // Load all skills in parallel
    const results = await Promise.allSettled(
        skillPaths.map(async path => {
            const skill = await loadSkill(path, options);
            return { path, skill };
        }),
    );

    // Process results
    for (const result of results) {
        if (result.status === 'fulfilled') {
            const { skill } = result.value;
            skillsMap.set(skill.id, skill);
        } else {
            // Collect errors but don't throw yet
            const error = result.reason as Error;
            const path = skillPaths[results.indexOf(result)];
            errors.push({ path: path || 'unknown', error });
        }
    }

    // If there were errors, throw with details
    if (errors.length > 0) {
        const errorMessages = errors.map(({ path, error }) => `  - ${path}: ${error.message}`).join('\n');
        throw new Error(`Failed to load ${errors.length} skill(s):\n${errorMessages}`);
    }

    return skillsMap;
}

/**
 * Validates that a skill directory is properly structured
 * @param skillPath Path to the skill directory
 * @returns True if directory contains a valid SKILL.md file
 *
 * @example
 * ```typescript
 * const isValid = await validateSkillDirectory('.mastra/skills/code-review');
 * if (!isValid) {
 *   console.error('Invalid skill directory');
 * }
 * ```
 */
export async function validateSkillDirectory(skillPath: string): Promise<boolean> {
    try {
        // Try to load the skill (which validates structure)
        await loadSkill(skillPath, { validate: true });
        return true;
    } catch {
        return false;
    }
}
