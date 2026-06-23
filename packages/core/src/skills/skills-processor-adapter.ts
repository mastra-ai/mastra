/**
 * AgentSkillsProcessorAdapter — lightweight skills processor that works
 * directly with WorkspaceSkills, without requiring a full Workspace.
 *
 * Used when the Agent has `skills` configured but no `workspace`.
 * Provides the same system prompt injection as SkillsProcessor.
 */

import type { ProcessInputStepArgs, Processor } from '../processors/index';
import type { Skill, SkillFormat, WorkspaceSkills } from '../workspace/skills/types';

export class AgentSkillsProcessorAdapter implements Processor<'skills-processor'> {
  readonly id = 'skills-processor' as const;
  readonly name = 'Skills Processor (Agent)';

  private readonly _skills: WorkspaceSkills;
  private readonly _format: SkillFormat;

  constructor(skills: WorkspaceSkills, format?: SkillFormat) {
    this._skills = skills;
    this._format = format ?? 'xml';
  }

  /**
   * List all skills available to this processor.
   */
  async listSkills(): Promise<
    Array<{
      name: string;
      description: string;
      license?: string;
    }>
  > {
    const skillsList = await this._skills.list();
    return skillsList.map(skill => ({
      name: skill.name,
      description: skill.description,
      license: skill.license,
    }));
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private formatLocation(skill: Skill): string {
    return `${skill.path}/SKILL.md`;
  }

  private formatSourceType(skill: Skill): string {
    return skill.source.type;
  }

  private async formatAvailableSkills(): Promise<string> {
    const skillsList = await this._skills.list();
    if (!skillsList || skillsList.length === 0) {
      return '';
    }

    const skillPromises = skillsList.map(meta => this._skills.get(meta.path));
    const fullSkills = (await Promise.all(skillPromises)).filter((s): s is Skill => s !== undefined && s !== null);
    const dedupedSkills = Array.from(new Map(fullSkills.map(skill => [skill.path, skill])).values());
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

        return `<available_skills>\n${skillsXml}\n</available_skills>`;
      }

      case 'json': {
        return `Available Skills:\n\n${JSON.stringify(
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
        return `# Available Skills\n\n${skillsMd}`;
      }

      default: {
        const _exhaustive: never = this._format;
        return _exhaustive;
      }
    }
  }

  async processInputStep({ messageList, stepNumber, requestContext }: ProcessInputStepArgs) {
    if (stepNumber === 0) {
      await this._skills.maybeRefresh({ requestContext });
    }
    const skillsList = await this._skills.list();
    const hasSkills = skillsList && skillsList.length > 0;

    if (hasSkills) {
      const availableSkillsMessage = await this.formatAvailableSkills();
      if (availableSkillsMessage) {
        messageList.addSystem({
          role: 'system',
          content: availableSkillsMessage,
        });
      }

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
