/**
 * AgentSkillsResolver — resolves agent-level skills config into a WorkspaceSkills.
 *
 * Handles the split between path-based skills (resolved via LocalSkillSource)
 * and inline skills (served from InlineSkillSource), producing a single
 * WorkspaceSkillsImpl that the Agent can use for processor injection and tool creation.
 */

import type { RequestContext } from '../request-context';
import { LocalSkillSource } from '../workspace/skills/local-skill-source';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from '../workspace/skills/skill-source';
import type { WorkspaceSkills } from '../workspace/skills/types';
import { WorkspaceSkillsImpl } from '../workspace/skills/workspace-skills';
import { isInlineSkill } from './create-skill';
import { InlineSkillSource } from './inline-skill-source';
import type { InlineSkill, SkillInput } from './types';

// =============================================================================
// CompositeSkillSource
// =============================================================================

/**
 * Combines multiple SkillSources, routing by path prefix.
 * Inline skills use `inline:<name>` paths; everything else goes to LocalSkillSource.
 */
class CompositeSkillSource implements SkillSource {
  readonly #local: LocalSkillSource;
  readonly #inline: InlineSkillSource;

  constructor(local: LocalSkillSource, inline: InlineSkillSource) {
    this.#local = local;
    this.#inline = inline;
  }

  #route(path: string): SkillSource {
    return path.startsWith('inline/') ? this.#inline : this.#local;
  }

  exists(path: string): Promise<boolean> {
    return this.#route(path).exists(path);
  }

  stat(path: string): Promise<SkillSourceStat> {
    return this.#route(path).stat(path);
  }

  readFile(path: string): Promise<string | Buffer> {
    return this.#route(path).readFile(path);
  }

  readdir(path: string): Promise<SkillSourceEntry[]> {
    return this.#route(path).readdir(path);
  }

  async realpath(path: string): Promise<string> {
    const source = this.#route(path);
    return source.realpath ? source.realpath(path) : path;
  }
}

// =============================================================================
// Resolver
// =============================================================================

/**
 * Resolve an array of SkillInput items into a WorkspaceSkills instance.
 *
 * @param skills - Array of path strings and/or inline skills
 * @returns A WorkspaceSkills implementation ready for use by the Agent
 */
export function resolveAgentSkills(skills: SkillInput[]): WorkspaceSkills {
  // Partition into inline skills and path strings
  const inlineSkills: InlineSkill[] = [];
  const pathSkills: string[] = [];

  for (const skill of skills) {
    if (isInlineSkill(skill)) {
      inlineSkills.push(skill);
    } else {
      pathSkills.push(skill);
    }
  }

  // Build the skill source(s)
  let source: SkillSource;

  // All skill paths that WorkspaceSkillsImpl will scan
  const skillPaths: string[] = [...pathSkills];

  if (inlineSkills.length > 0 && pathSkills.length > 0) {
    // Mixed: composite source
    const local = new LocalSkillSource();
    const inline = new InlineSkillSource(inlineSkills);
    source = new CompositeSkillSource(local, inline);
    // Add inline skill paths
    for (const skill of inlineSkills) {
      skillPaths.push(`inline/${skill.name}`);
    }
  } else if (inlineSkills.length > 0) {
    // Only inline skills
    const inline = new InlineSkillSource(inlineSkills);
    source = inline;
    for (const skill of inlineSkills) {
      skillPaths.push(`inline/${skill.name}`);
    }
  } else {
    // Only path-based skills
    source = new LocalSkillSource();
  }

  return new WorkspaceSkillsImpl({
    source,
    skills: skillPaths,
    validateOnLoad: true,
  });
}

/**
 * Merge two WorkspaceSkills instances by combining their skill lists.
 * Agent-level skills take precedence on name conflicts (returned first in list).
 */
export async function mergeWorkspaceSkills(
  agentSkills: WorkspaceSkills,
  workspaceSkills: WorkspaceSkills,
): Promise<{ merged: WorkspaceSkills; agentSkillNames: Set<string> }> {
  // For now, we don't physically merge the implementations.
  // Instead, we create a MergedWorkspaceSkills wrapper that delegates to both.
  return {
    merged: new MergedWorkspaceSkills(agentSkills, workspaceSkills),
    agentSkillNames: new Set((await agentSkills.list()).map(s => s.name)),
  };
}

/**
 * A WorkspaceSkills wrapper that merges two skill sets.
 * Agent skills take precedence on name conflicts.
 */
class MergedWorkspaceSkills implements WorkspaceSkills {
  readonly #primary: WorkspaceSkills;
  readonly #secondary: WorkspaceSkills;

  constructor(primary: WorkspaceSkills, secondary: WorkspaceSkills) {
    this.#primary = primary;
    this.#secondary = secondary;
  }

  async list() {
    const primaryList = await this.#primary.list();
    const secondaryList = await this.#secondary.list();
    const primaryNames = new Set(primaryList.map(s => s.name));
    // Agent-level skills win on name conflicts
    return [...primaryList, ...secondaryList.filter(s => !primaryNames.has(s.name))];
  }

  async get(name: string) {
    const primary = await this.#primary.get(name);
    if (primary) return primary;
    return this.#secondary.get(name);
  }

  async has(name: string) {
    return (await this.#primary.has(name)) || (await this.#secondary.has(name));
  }

  async refresh() {
    await Promise.all([this.#primary.refresh(), this.#secondary.refresh()]);
  }

  async maybeRefresh(context?: { requestContext?: RequestContext }) {
    await Promise.all([this.#primary.maybeRefresh(context), this.#secondary.maybeRefresh(context)]);
  }

  async search(query: string, options?: Parameters<WorkspaceSkills['search']>[1]) {
    const [primaryResults, secondaryResults] = await Promise.all([
      this.#primary.search(query, options),
      this.#secondary.search(query, options),
    ]);
    // Combine and sort by score
    return [...primaryResults, ...secondaryResults].sort((a, b) => b.score - a.score);
  }

  async getReference(skillName: string, referencePath: string) {
    const primary = await this.#primary.getReference(skillName, referencePath);
    if (primary !== null) return primary;
    return this.#secondary.getReference(skillName, referencePath);
  }

  async getScript(skillName: string, scriptPath: string) {
    const primary = await this.#primary.getScript(skillName, scriptPath);
    if (primary !== null) return primary;
    return this.#secondary.getScript(skillName, scriptPath);
  }

  async getAsset(skillName: string, assetPath: string) {
    const primary = await this.#primary.getAsset(skillName, assetPath);
    if (primary !== null) return primary;
    return this.#secondary.getAsset(skillName, assetPath);
  }

  async listReferences(skillName: string) {
    const primary = await this.#primary.listReferences(skillName);
    if (primary.length > 0) return primary;
    return this.#secondary.listReferences(skillName);
  }

  async listScripts(skillName: string) {
    const primary = await this.#primary.listScripts(skillName);
    if (primary.length > 0) return primary;
    return this.#secondary.listScripts(skillName);
  }

  async listAssets(skillName: string) {
    const primary = await this.#primary.listAssets(skillName);
    if (primary.length > 0) return primary;
    return this.#secondary.listAssets(skillName);
  }
}
