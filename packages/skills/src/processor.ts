import z from 'zod';
import type { ProcessInputStepArgs, Processor } from '@mastra/core/processors';
import { createTool } from '@mastra/core/tools';

import { Skills, type SkillsBM25Config } from './skills';
import type { SkillFormat, SkillMetadata, Skill } from './types';

// =========================================================================
// Configuration
// =========================================================================

/**
 * Configuration options for SkillsProcessor
 */
export interface SkillsProcessorOptions {
  /** Path or paths to directories containing skills (default: ./skills) */
  skillsPaths?: string | string[];
  /** Format for skill injection (default: 'xml') */
  format?: SkillFormat;
  /** Validate skills on load (default: true) */
  validateSkills?: boolean;
  /** BM25 search configuration */
  bm25Config?: SkillsBM25Config;
  /** Pre-existing Skills instance (if not provided, one will be created) */
  skills?: Skills;
}

// =========================================================================
// SkillsProcessor
// =========================================================================

/**
 * Processor for Agent Skills specification.
 * Discovers skills from filesystem and makes them available to agents via tools.
 *
 * Uses the Skills class for skill management and search.
 *
 * @example
 * ```typescript
 * const processor = new SkillsProcessor({
 *   skillsPaths: ['./skills', 'node_modules/@company/skills'],
 *   format: 'xml',
 * });
 *
 * // Or with a pre-existing Skills instance
 * const skills = new Skills({ id: 'my-skills', paths: './skills' });
 * const processor = new SkillsProcessor({ skills });
 * ```
 */
export class SkillsProcessor implements Processor {
  readonly id = 'skills-processor';
  readonly name = 'Skills Processor';

  /** Skills instance for managing skills */
  readonly skills: Skills;

  /** Format for skill injection */
  private format: SkillFormat;

  /** Set of activated skill names */
  private activatedSkills: Set<string> = new Set();

  constructor(opts?: SkillsProcessorOptions) {
    this.format = opts?.format ?? 'xml';

    // Use provided Skills instance or create a new one
    if (opts?.skills) {
      this.skills = opts.skills;
    } else {
      const skillsPaths = opts?.skillsPaths ?? ['./skills'];
      this.skills = new Skills(
        {
          id: 'skills-processor-skills',
          paths: skillsPaths,
          validateOnLoad: opts?.validateSkills ?? true,
        },
        opts?.bm25Config,
      );
    }
  }

  // =========================================================================
  // Formatting Methods
  // =========================================================================

  /**
   * Format available skills metadata based on configured format
   */
  private formatAvailableSkills(): string {
    const skills = this.skills.list();

    if (skills.length === 0) {
      return '';
    }

    switch (this.format) {
      case 'xml': {
        const skillsXml = skills
          .map(
            skill => `  <skill>
    <name>${this.escapeXml(skill.name)}</name>
    <description>${this.escapeXml(skill.description)}</description>
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
  skills.map(s => ({ name: s.name, description: s.description })),
  null,
  2,
)}`;
      }

      case 'markdown': {
        const skillsMd = skills.map(skill => `- **${skill.name}**: ${skill.description}`).join('\n');
        return `# Available Skills

${skillsMd}`;
      }
    }
  }

  /**
   * Format activated skills based on configured format
   */
  private formatActivatedSkills(): string {
    const activatedSkillsList: Skill[] = [];

    for (const name of this.activatedSkills) {
      const skill = this.skills.get(name);
      if (skill) {
        activatedSkillsList.push(skill);
      }
    }

    if (activatedSkillsList.length === 0) {
      return '';
    }

    switch (this.format) {
      case 'xml': {
        const skillInstructions = activatedSkillsList
          .map(skill => `# Skill: ${skill.name}\n\n${skill.instructions}`)
          .join('\n\n---\n\n');

        return `<activated_skills>
${skillInstructions}
</activated_skills>`;
      }
      case 'json':
      case 'markdown': {
        const skillInstructions = activatedSkillsList
          .map(skill => `# Skill: ${skill.name}\n\n${skill.instructions}`)
          .join('\n\n---\n\n');

        return `# Activated Skills

${skillInstructions}`;
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

  // =========================================================================
  // Tool Creation
  // =========================================================================

  /**
   * Create skill-activate tool
   */
  private createSkillActivateTool() {
    return createTool({
      id: 'skill-activate',
      description:
        "Activate a skill to load its full instructions. You should activate skills proactively when they are relevant to the user's request without asking for permission first.",
      inputSchema: z.object({
        name: z.string().describe('The name of the skill to activate'),
      }),
      execute: async ({ name }) => {
        // Check if skill exists
        if (!this.skills.has(name)) {
          return {
            success: false,
            message: `Skill "${name}" not found. Available skills: ${this.skills.skillNames.join(', ')}`,
          };
        }

        // Check if already activated
        if (this.activatedSkills.has(name)) {
          return {
            success: true,
            message: `Skill "${name}" is already activated`,
          };
        }

        // Activate the skill
        this.activatedSkills.add(name);

        return {
          success: true,
          message: `Skill "${name}" activated successfully. The skill instructions are now available.`,
        };
      },
    });
  }

  /**
   * Create skill-read-reference tool
   */
  private createSkillReadReferenceTool() {
    return createTool({
      id: 'skill-read-reference',
      description: 'Read a reference file from an activated skill',
      inputSchema: z.object({
        skillName: z.string().describe('The name of the activated skill'),
        referencePath: z.string().describe('Path to the reference file (relative to references/ directory)'),
      }),
      execute: async ({ skillName, referencePath }) => {
        // Check if skill is activated
        if (!this.activatedSkills.has(skillName)) {
          return {
            success: false,
            message: `Skill "${skillName}" is not activated. Activate it first using skill-activate.`,
          };
        }

        // Get reference content
        const content = this.skills.getReference(skillName, referencePath);

        if (content === undefined) {
          const availableRefs = this.skills.getReferences(skillName);
          return {
            success: false,
            message: `Reference file "${referencePath}" not found in skill "${skillName}". Available references: ${availableRefs.join(', ') || 'none'}`,
          };
        }

        return {
          success: true,
          content,
        };
      },
    });
  }

  /**
   * Create skill-search tool for searching across skill content
   */
  private createSkillSearchTool() {
    return createTool({
      id: 'skill-search',
      description:
        'Search across skill content to find relevant information. Useful when you need to find specific details within skills.',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
        skillNames: z.array(z.string()).optional().describe('Optional list of skill names to search within'),
        topK: z.number().optional().describe('Maximum number of results to return (default: 5)'),
      }),
      execute: async ({ query, skillNames, topK }) => {
        const results = this.skills.search(query, { topK, skillNames });

        if (results.length === 0) {
          return {
            success: true,
            message: 'No results found',
            results: [],
          };
        }

        return {
          success: true,
          results: results.map(r => ({
            skillName: r.skillName,
            source: r.source,
            score: r.score,
            preview: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
          })),
        };
      },
    });
  }

  // =========================================================================
  // Processor Interface
  // =========================================================================

  /**
   * Process input step - inject available skills and provide skill tools
   */
  async processInputStep({ messageList, tools }: ProcessInputStepArgs) {
    const hasSkills = this.skills.size > 0;

    // 1. Inject available skills metadata (if any skills discovered)
    if (hasSkills) {
      const availableSkillsMessage = this.formatAvailableSkills();
      if (availableSkillsMessage) {
        messageList.addSystem({
          role: 'system',
          content: availableSkillsMessage,
        });
      }

      // Add instruction to activate skills proactively
      messageList.addSystem({
        role: 'system',
        content:
          'When a user asks about a topic covered by an available skill, activate that skill immediately using the skill-activate tool. Do not ask for permission - just activate the skill and use its instructions to answer the question.',
      });
    }

    // 2. Inject activated skills instructions (if any activated)
    if (this.activatedSkills.size > 0) {
      const activatedSkillsMessage = this.formatActivatedSkills();
      if (activatedSkillsMessage) {
        messageList.addSystem({
          role: 'system',
          content: activatedSkillsMessage,
        });
      }
    }

    // 3. Build skill tools
    const skillTools: Record<string, ReturnType<typeof createTool>> = {};

    if (hasSkills) {
      skillTools['skill-activate'] = this.createSkillActivateTool();
      skillTools['skill-search'] = this.createSkillSearchTool();
    }

    if (this.activatedSkills.size > 0) {
      skillTools['skill-read-reference'] = this.createSkillReadReferenceTool();
    }

    return {
      messageList,
      tools: {
        ...tools,
        ...skillTools,
      },
    };
  }
}
