import type { MastraSkills, Skill } from '@mastra/core/skills';
import { BaseProcessor } from '@mastra/core/processors';
import type { ProcessInputArgs, ProcessInputResult } from '@mastra/core/processors';

import type { Skills } from '../skills';

/**
 * Options for the StaticSkills processor
 */
export interface StaticSkillsOptions {
  /**
   * Skills instance to fetch static skills from.
   * If omitted, inherits from Mastra at runtime.
   */
  skills?: Skills | MastraSkills;
  /**
   * Specific skill names to always inject (if empty, injects all skills)
   * @default []
   */
  skillNames?: string[];
  /**
   * How to format the skills in the system message
   * @default 'xml'
   */
  format?: 'xml' | 'markdown' | 'plain';
  /**
   * Custom formatter function for the skills content
   * If provided, overrides the format option
   */
  formatter?: (skills: Array<{ name: string; instructions: string }>) => string;
}

/**
 * StaticSkills is an input processor that injects specific skills
 * into the system message unconditionally.
 *
 * Use this for skills that should always be available to the agent,
 * similar to StaticKnowledge but for skill instructions.
 *
 * @example
 * ```typescript
 * const skills = new Skills({
 *   id: 'my-skills',
 *   paths: './skills',
 * });
 *
 * const processor = new StaticSkills({
 *   skills,
 *   skillNames: ['brand-guidelines', 'code-style'],
 *   format: 'xml'
 * });
 *
 * const agent = new Agent({
 *   processors: [processor],
 *   // ...
 * });
 * ```
 */
export class StaticSkills extends BaseProcessor<'static-skills'> {
  readonly id = 'static-skills' as const;
  readonly name = 'StaticSkills';

  private skills?: Skills | MastraSkills;
  private skillNames: string[];
  private format: 'xml' | 'markdown' | 'plain';
  private formatter?: (skills: Array<{ name: string; instructions: string }>) => string;

  constructor(options: StaticSkillsOptions = {}) {
    super();
    this.skills = options.skills;
    this.skillNames = options.skillNames ?? [];
    this.format = options.format ?? 'xml';
    this.formatter = options.formatter;
  }

  /**
   * Get the skills instance from options or inherited from Mastra
   */
  private getSkillsInstance(): Skills | MastraSkills {
    if (this.skills) {
      return this.skills;
    }

    // Try to inherit from the registered Mastra instance
    if (this.mastra?.getSkills) {
      const inherited = this.mastra.getSkills();
      if (inherited) {
        return inherited;
      }
    }

    throw new Error(
      'No skills instance available. Either pass a skills instance to the processor, ' +
        'or register a skills instance with Mastra.',
    );
  }

  /**
   * Process input by fetching static skills and adding to system messages
   */
  async processInput(args: ProcessInputArgs): Promise<ProcessInputResult> {
    const { messageList } = args;

    // Get the skills instance
    const skills = this.getSkillsInstance();

    // Get the skills to inject
    const skillsToInject: Skill[] = [];

    if (this.skillNames.length > 0) {
      // Inject specific skills
      for (const name of this.skillNames) {
        const skill = skills.get(name);
        if (skill) {
          skillsToInject.push(skill);
        }
      }
    } else {
      // Inject all skills
      for (const metadata of skills.list()) {
        const skill = skills.get(metadata.name);
        if (skill) {
          skillsToInject.push(skill);
        }
      }
    }

    if (skillsToInject.length === 0) {
      return messageList;
    }

    // Format the skills content
    const skillsContent = this.formatSkills(skillsToInject);

    // Add as system message
    messageList.addSystem({
      role: 'system',
      content: skillsContent,
    });

    return messageList;
  }

  /**
   * Format skills based on the configured format
   */
  private formatSkills(skills: Skill[]): string {
    const formatted = skills.map(s => ({ name: s.name, instructions: s.instructions }));

    // Use custom formatter if provided
    if (this.formatter) {
      return this.formatter(formatted);
    }

    switch (this.format) {
      case 'xml':
        return this.formatAsXml(formatted);
      case 'markdown':
        return this.formatAsMarkdown(formatted);
      case 'plain':
      default:
        return this.formatAsPlain(formatted);
    }
  }

  /**
   * Format skills as XML
   */
  private formatAsXml(skills: Array<{ name: string; instructions: string }>): string {
    const itemsXml = skills
      .map(skill => {
        return `  <skill name="${this.escapeXml(skill.name)}">\n    ${skill.instructions}\n  </skill>`;
      })
      .join('\n');

    return `<static_skills>\n${itemsXml}\n</static_skills>`;
  }

  /**
   * Format skills as Markdown
   */
  private formatAsMarkdown(skills: Array<{ name: string; instructions: string }>): string {
    const itemsMd = skills
      .map(skill => {
        return `## ${skill.name}\n\n${skill.instructions}`;
      })
      .join('\n\n---\n\n');

    return `# Skills\n\n${itemsMd}`;
  }

  /**
   * Format skills as plain text
   */
  private formatAsPlain(skills: Array<{ name: string; instructions: string }>): string {
    return skills
      .map(skill => {
        return `[${skill.name}]:\n${skill.instructions}`;
      })
      .join('\n\n');
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
}
