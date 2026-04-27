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
 * Configuration options for SkillsProcessor
 */
export interface SkillsProcessorOptions {
  /**
   * Workspace instance containing skills.
   * Skills are accessed via workspace.skills.
   */
  workspace: Workspace;

  /**
   * Format for skill injection (default: 'xml')
   */
  format?: SkillFormat;
}

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

  /** Workspace instance */
  private readonly _workspace: Workspace;

  /** Format for skill injection */
  private readonly _format: SkillFormat;

  constructor(opts: SkillsProcessorOptions) {
    this._workspace = opts.workspace;
    this._format = opts.format ?? 'xml';
  }

  /**
   * Get the workspace skills interface
   */
  private get skills(): WorkspaceSkills | undefined {
    return this._workspace.skills;
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
    const skillsList = await this.skills?.list();
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
   * Format skill location (path to SKILL.md file)
   */
  private formatLocation(skill: Skill): string {
    return `${skill.path}/SKILL.md`;
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
    const skillsList = await this.skills?.list();
    if (!skillsList || skillsList.length === 0) {
      return '';
    }

    // Get full skill objects to include source info (parallel fetch).
    // Use meta.path (not meta.name) so same-named skills each resolve to their specific entry.
    const skillPromises = skillsList.map(meta => this.skills?.get(meta.path));
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
      await this.skills?.maybeRefresh({ requestContext });
    }
    const skillsList = await this.skills?.list();
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

      // Add instruction to use the skill tool
      messageList.addSystem({
        role: 'system',
        content:
          'IMPORTANT: Skills are NOT tools. Do not call skill names directly as tool names. ' +
          'To use a skill, call the `skill` tool with the skill name as the "name" parameter. ' +
          'If multiple skills share the same name, use the skill path (shown in the location field) instead of the name to disambiguate. ' +
          'When a user asks about a topic covered by an available skill, activate it immediately without asking for permission first.',
      });
    }
  }
}
