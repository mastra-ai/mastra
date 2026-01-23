import type { LoadedSkill, LoadSkillOptions } from './types';
import { SkillError } from './types';
import { loadSkill, loadSkills } from './loader';
import { SKILL_ERROR_CODES } from './constants';

/**
 * Manages loaded skills with caching and lifecycle management
 *
 * @example
 * ```typescript
 * const manager = new SkillsManager();
 * await manager.load(['.mastra/skills/code-review']);
 * const skill = manager.get('code-review');
 * ```
 */
export class SkillsManager {
    /**
     * Cache of loaded skills by ID
     */
    private skills: Map<string, LoadedSkill> = new Map();

    /**
     * Default options for loading skills
     */
    private defaultOptions: LoadSkillOptions;

    constructor(options: LoadSkillOptions = {}) {
        this.defaultOptions = options;
    }

    /**
     * Loads skills from an array of paths and caches them
     * @param paths Array of skill directory paths
     * @param options Optional loading options (overrides default)
     * @returns Promise that resolves when all skills are loaded
     *
     * @example
     * ```typescript
     * await manager.load([
     *   '.mastra/skills/code-review',
     *   '.mastra/skills/documentation'
     * ]);
     * ```
     */
    async load(paths: string[], options?: LoadSkillOptions): Promise<void> {
        const opts = { ...this.defaultOptions, ...options };
        const loadedSkills = await loadSkills(paths, opts);

        // Add to cache
        for (const [id, skill] of loadedSkills.entries()) {
            this.skills.set(id, skill);
        }
    }

    /**
     * Gets a skill by ID from the cache
     * @param skillId Skill identifier
     * @returns Loaded skill or undefined if not found
     *
     * @example
     * ```typescript
     * const skill = manager.get('code-review');
     * if (skill) {
     *   console.log(skill.content.instructions);
     * }
     * ```
     */
    get(skillId: string): LoadedSkill | undefined {
        return this.skills.get(skillId);
    }

    /**
     * Gets all loaded skills
     * @returns Map of all loaded skills
     *
     * @example
     * ```typescript
     * const allSkills = manager.getAll();
     * console.log(`Loaded ${allSkills.size} skills`);
     * ```
     */
    getAll(): Map<string, LoadedSkill> {
        return new Map(this.skills);
    }

    /**
     * Checks if a skill is loaded
     * @param skillId Skill identifier
     * @returns True if skill is loaded
     */
    has(skillId: string): boolean {
        return this.skills.has(skillId);
    }

    /**
     * Reloads a specific skill from disk
     * Useful for development when skill files change
     * @param skillId Skill identifier
     * @throws Error if skill not found in cache
     *
     * @example
     * ```typescript
     * await manager.reload('code-review');
     * ```
     */
    async reload(skillId: string): Promise<void> {
        const existingSkill = this.skills.get(skillId);
        if (!existingSkill) {
            throw new SkillError(
                `Cannot reload skill "${skillId}": not found in cache`,
                SKILL_ERROR_CODES.CACHE_ERROR,
                skillId,
            );
        }

        // Reload from the same path
        const reloadedSkill = await loadSkill(existingSkill.path, this.defaultOptions);
        this.skills.set(skillId, reloadedSkill);
    }

    /**
     * Reloads all skills from disk
     * @returns Promise that resolves when all skills are reloaded
     */
    async reloadAll(): Promise<void> {
        const paths = Array.from(this.skills.values()).map(skill => skill.path);
        this.clear();
        await this.load(paths);
    }

    /**
     * Removes a skill from the cache
     * @param skillId Skill identifier
     * @returns True if skill was removed
     */
    remove(skillId: string): boolean {
        return this.skills.delete(skillId);
    }

    /**
     * Clears all loaded skills from cache
     *
     * @example
     * ```typescript
     * manager.clear();
     * console.log(manager.getAll().size); // 0
     * ```
     */
    clear(): void {
        this.skills.clear();
    }

    /**
     * Gets the number of loaded skills
     * @returns Number of skills in cache
     */
    size(): number {
        return this.skills.size;
    }

    /**
     * Lists all skill IDs
     * @returns Array of skill IDs
     */
    listIds(): string[] {
        return Array.from(this.skills.keys());
    }

    /**
     * Filters skills by tag
     * @param tag Tag to filter by
     * @returns Array of skills with the specified tag
     *
     * @example
     * ```typescript
     * const codingSkills = manager.filterByTag('coding');
     * ```
     */
    filterByTag(tag: string): LoadedSkill[] {
        return Array.from(this.skills.values()).filter(
            skill => skill.content.frontmatter.tags?.includes(tag),
        );
    }

    /**
     * Searches skills by keyword in name, description, or keywords
     * @param query Search query (case-insensitive)
     * @returns Array of matching skills
     *
     * @example
     * ```typescript
     * const results = manager.search('code review');
     * ```
     */
    search(query: string): LoadedSkill[] {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.skills.values()).filter(skill => {
            const name = skill.content.frontmatter.name?.toLowerCase() || '';
            const description = skill.content.frontmatter.description?.toLowerCase() || '';
            const keywords = skill.content.frontmatter.keywords?.map(k => k.toLowerCase()) || [];
            const instructions = skill.content.instructions.toLowerCase();

            return (
                name.includes(lowerQuery) ||
                description.includes(lowerQuery) ||
                keywords.some(k => k.includes(lowerQuery)) ||
                instructions.includes(lowerQuery)
            );
        });
    }

    /**
     * Gets combined instructions from all loaded skills
     * @param separator Separator between skill instructions (default: "\n\n---\n\n")
     * @returns Combined instructions string
     */
    getCombinedInstructions(separator: string = '\n\n---\n\n'): string {
        return Array.from(this.skills.values())
            .map(skill => {
                const header = `## Skill: ${skill.content.frontmatter.name}\n${skill.content.frontmatter.description}\n`;
                return `${header}\n${skill.content.instructions}`;
            })
            .join(separator);
    }
}
