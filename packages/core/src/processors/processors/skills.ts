/**
 * SkillsProcessor - Processor for Agent Skills specification.
 *
 * Injects available skills metadata into the system message so the model
 * knows which skills exist and can call the `skill` tool to load instructions.
 *
 * @example
 * ```typescript
 * // Auto-created by Agent when workspace has skills
 * const agent = new Agent({
 *   workspace: new Workspace({
 *     filesystem: new LocalFilesystem({ basePath: './data' }),
 *     skills: ['skills'],
 *   }),
 * });
 *
 * // Or explicit processor control:
 * const agent = new Agent({
 *   workspace,
 *   inputProcessors: [new SkillsProcessor({ workspace })],
 * });
 * ```
 */
import type { Skill, SkillFormat, WorkspaceSkills } from '../../workspace/skills';
import type { Workspace } from '../../workspace/workspace';
import type { ProcessInputStepArgs, Processor } from '../index';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Options shared by both SkillsProcessor configuration shapes.
 */
interface SkillsProcessorBaseOptions {
  format?: SkillFormat;
  /**
   * Override how a skill's `location` field is rendered in the injected
   * metadata. Defaults to `${skill.path}/SKILL.md`, which is a path on the
   * server running the agent. When the model's filesystem tools operate
   * somewhere else (e.g. a sandbox workspace), that server path is
   * meaningless to the model. Override this to advertise a location the
   * model can actually reach, or a plain identifier.
   *
   * Remapped locations remain valid skill identifiers: the processor
   * registers each rendered location as an alias with the skills registry
   * (via `WorkspaceSkills.registerLocationAlias`), so the `skill` and
   * `skill_read` tools resolve it back to the underlying skill. If a custom
   * `WorkspaceSkills` implementation does not support alias registration,
   * the injected instruction instead directs the model to refer to skills
   * by name.
   */
  formatLocation?: (skill: Skill) => string;
}

/**
 * Configuration options for SkillsProcessor.
 * Provide either `skills` (WorkspaceSkills directly) or `workspace` (skills resolved via workspace.skills), not both.
 */
export type SkillsProcessorOptions =
  | ({ skills: WorkspaceSkills; workspace?: never } & SkillsProcessorBaseOptions)
  | ({ workspace: Workspace; skills?: never } & SkillsProcessorBaseOptions);

// =============================================================================
// SkillsProcessor
// =============================================================================

/**
 * Processor for Agent Skills specification.
 * Injects available skills metadata into the system message.
 * Tools are provided separately via Agent.listSkillTools().
 */
export class SkillsProcessor implements Processor<'skills-processor'> {
  readonly id = 'skills-processor' as const;
  readonly name = 'Skills Processor';

  /** Resolved skills interface */
  private readonly _skills: WorkspaceSkills | undefined;

  /** Format for skill injection */
  private readonly _format: SkillFormat;

  /** Optional override for rendering the location field */
  private readonly _formatLocation: ((skill: Skill) => string) | undefined;

  constructor(opts: SkillsProcessorOptions) {
    this._skills = 'skills' in opts && opts.skills ? opts.skills : opts.workspace?.skills;
    this._format = opts.format ?? 'xml';
    this._formatLocation = opts.formatLocation;
  }

  /**
   * List all skills available to this processor.
   * Used by the server to expose skills in the agent API response.
   */
  async listSkills(): Promise<
    Array<{
      name: string;
      description: string;
      license?: string;
    }>
  > {
    const skillsList = await this._skills?.list();
    if (!skillsList) return [];

    return skillsList.map(skill => ({
      name: skill.name,
      description: skill.description,
      license: skill.license,
    }));
  }

  // ===========================================================================
  // Formatting Methods
  // ===========================================================================

  /**
   * Format skill location (path to SKILL.md file).
   * Remapped locations are registered as aliases with the skills registry so
   * the `skill` and `skill_read` tools can resolve them back to the skill.
   */
  private formatLocation(skill: Skill): string {
    if (!this._formatLocation) return `${skill.path}/SKILL.md`;
    const location = this._formatLocation(skill);
    this._skills?.registerLocationAlias?.(location, skill.path);
    return location;
  }

  /**
   * Format skill source type for display
   */
  private formatSourceType(skill: Skill): string {
    return skill.source.type;
  }

  /**
   * Format available skills metadata based on configured format.
   * Skills are sorted by name for deterministic output (prompt cache stability).
   */
  private async formatAvailableSkills(): Promise<string> {
    const skillsList = await this._skills?.list();
    if (!skillsList || skillsList.length === 0) {
      return '';
    }

    // Get full skill objects to include source info (parallel fetch).
    // Use meta.path (not meta.name) so same-named skills each resolve to their specific entry.
    const skillPromises = skillsList.map(meta => this._skills?.get(meta.path));
    const fullSkills = (await Promise.all(skillPromises)).filter((s): s is Skill => s !== undefined && s !== null);
    const dedupedSkills = Array.from(new Map(fullSkills.map(skill => [skill.path, skill])).values());

    // Sort by name for deterministic output (avoids busting prompt cache)
    dedupedSkills.sort((a, b) => a.name.localeCompare(b.name));

    switch (this._format) {
      case 'xml': {
        const skillsXml = dedupedSkills
          .map(
            skill => `  <skill>
    <name>${this.escapeXml(skill.name)}</name>
    <description>${this.escapeXml(skill.description)}</description>
    <location>${this.escapeXml(this.formatLocation(skill))}</location>
    <source>${this.escapeXml(this.formatSourceType(skill))}</source>
  </skill>`,
          )
          .join('\n');

        return `<available_skills>
${skillsXml}
</available_skills>`;
      }

      case 'json': {
        return `Available Skills:

${JSON.stringify(
  dedupedSkills.map(s => ({
    name: s.name,
    description: s.description,
    location: this.formatLocation(s),
    source: this.formatSourceType(s),
  })),
  null,
  2,
)}`;
      }

      case 'markdown': {
        const skillsMd = dedupedSkills
          .map(
            skill =>
              `- **${skill.name}** [${this.formatSourceType(skill)}] (${this.formatLocation(skill)}): ${skill.description}`,
          )
          .join('\n');
        return `# Available Skills

${skillsMd}`;
      }

      default: {
        const _exhaustive: never = this._format;
        return _exhaustive;
      }
    }
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ===========================================================================
  // processInputStep — system message injection only
  // ===========================================================================

  /**
   * Process input step - inject available skills metadata into the system
   * message.  Tools are provided by `Agent.listSkillTools()` instead.
   */
  async processInputStep({ messageList, stepNumber, requestContext }: ProcessInputStepArgs) {
    // Refresh skills on first step only (not every step in the agentic loop)
    if (stepNumber === 0) {
      await this._skills?.maybeRefresh({ requestContext });
    }
    const skillsList = await this._skills?.list();
    const hasSkills = skillsList && skillsList.length > 0;

    // Inject available skills metadata (if any skills discovered)
    if (hasSkills) {
      const availableSkillsMessage = await this.formatAvailableSkills();
      if (availableSkillsMessage) {
        messageList.addSystem({
          role: 'system',
          content: availableSkillsMessage,
        });
      }

      // Add instruction to use the skill tool. Remapped locations are
      // registered as aliases with the skills registry, so the location field
      // stays a valid tool identifier. Only when the skills implementation
      // cannot register aliases does the guidance fall back to by-name usage.
      const locationResolvable = !this._formatLocation || typeof this._skills?.registerLocationAlias === 'function';
      const locationGuidance = locationResolvable
        ? 'If multiple skills share the same name, use the exact location (shown in the location field) instead of the name to disambiguate. ' +
          'The location field identifies a skill for the `skill` and `skill_read` tools; it is not guaranteed to exist on your workspace filesystem, so read skill files with `skill_read` rather than with filesystem tools. '
        : 'The location field is informational metadata: it is not guaranteed to exist on your workspace filesystem and is not a skill identifier, so refer to skills by name and read skill files with `skill_read` rather than with filesystem tools. ';
      messageList.addSystem({
        role: 'system',
        content:
          'IMPORTANT: Skills are NOT tools. Do not call skill names directly as tool names. ' +
          'To use a skill, call the `skill` tool with the skill name as the "name" parameter. ' +
          locationGuidance +
          'When a user asks about a topic covered by an available skill, activate it immediately without asking for permission first.',
      });
    }
  }
}
