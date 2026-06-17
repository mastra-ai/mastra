export type SkillSource = 'workspace';

type JsonPrimitive = string | number | boolean | null;
export type HarnessSkillMetadata = Record<string, JsonPrimitive | JsonPrimitive[] | { [key: string]: unknown }>;

export interface HarnessSkill {
  name: string;
  description: string;
  instructions: string;
  category?: string;
  filePath: string;
  metadata?: HarnessSkillMetadata;
}

/**
 * Thrown by `session.useSkill` when the named skill is not present in any
 * workspace skill catalog.
 */
export class HarnessSkillNotFoundError extends Error {
  readonly name = 'HarnessSkillNotFoundError';
  readonly skillName: string;
  readonly searchedSources: readonly SkillSource[];

  constructor(opts: { name: string; searchedSources: readonly SkillSource[] }) {
    super(`Harness skill not found: ${opts.name} (searched: ${opts.searchedSources.join(', ') || 'none'})`);
    this.skillName = opts.name;
    this.searchedSources = opts.searchedSources;
  }
}
