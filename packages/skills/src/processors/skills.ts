import type { ProcessInputStepArgs } from '@mastra/core/processors';
import { BaseProcessor } from '@mastra/core/processors';
import type { MastraSkills } from '@mastra/core/skills';
import { createTool } from '@mastra/core/tools';
import z from 'zod';

import { extractLines } from '../bm25';
import { Skills } from '../skills';
import type { SkillsBM25Config } from '../skills';
import type { SkillFormat, Skill } from '../types';

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
  /**
   * Pre-existing Skills instance.
   * If not provided and skillsPaths is set, a new Skills instance will be created.
   * If neither is provided, the processor will try to inherit from Mastra at runtime.
   */
  skills?: Skills | MastraSkills;
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
 * // Option 1: Provide skills paths directly
 * const processor = new SkillsProcessor({
 *   skillsPaths: ['./skills', 'node_modules/@company/skills'],
 *   format: 'xml',
 * });
 *
 * // Option 2: Use a pre-existing Skills instance
 * const skills = new Skills({ id: 'my-skills', paths: './skills' });
 * const processor = new SkillsProcessor({ skills });
 *
 * // Option 3: Inherit from Mastra (when registered with an agent that has Mastra)
 * const processor = new SkillsProcessor(); // Will use mastra.getSkills()
 * ```
 */
export class SkillsProcessor extends BaseProcessor<'skills-processor'> {
  readonly id = 'skills-processor' as const;
  readonly name = 'Skills Processor';

  /** Skills instance for managing skills (may be set at construction or inherited from Mastra) */
  private _skills?: Skills | MastraSkills;

  /** Format for skill injection */
  private format: SkillFormat;

  /** Set of activated skill names */
  private activatedSkills: Set<string> = new Set();

  /** Map of skill name -> allowed tools (only for skills with allowedTools defined) */
  private skillAllowedTools: Map<string, string[]> = new Map();

  /** Options for creating skills lazily */
  private skillsOptions?: {
    paths: string | string[];
    validateOnLoad: boolean;
    bm25Config?: SkillsBM25Config;
  };

  constructor(opts?: SkillsProcessorOptions) {
    super();
    this.format = opts?.format ?? 'xml';

    // Use provided Skills instance or store options for lazy creation
    if (opts?.skills) {
      this._skills = opts.skills;
    } else if (opts?.skillsPaths) {
      // Create skills instance now
      this._skills = new Skills(
        {
          id: 'skills-processor-skills',
          paths: opts.skillsPaths,
          validateOnLoad: opts.validateSkills ?? true,
        },
        { bm25: opts.bm25Config },
      );
    }
    // Otherwise, will try to inherit from Mastra at runtime
  }

  /**
   * Get the skills instance from options or inherited from Mastra
   */
  private getSkillsInstance(): Skills | MastraSkills {
    if (this._skills) {
      return this._skills;
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
        'provide skillsPaths, or register a skills instance with Mastra.',
    );
  }

  /**
   * Get the skills instance (public accessor for testing)
   */
  get skills(): Skills | MastraSkills {
    return this.getSkillsInstance();
  }

  // =========================================================================
  // Formatting Methods
  // =========================================================================

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
   * Format available skills metadata based on configured format
   */
  private formatAvailableSkills(): string {
    const skills = this.getSkillsInstance();
    const skillsList = skills.list();

    if (skillsList.length === 0) {
      return '';
    }

    // Get full skill objects to include source info
    const fullSkills: Skill[] = [];
    for (const meta of skillsList) {
      const skill = skills.get(meta.name);
      if (skill) {
        fullSkills.push(skill);
      }
    }

    switch (this.format) {
      case 'xml': {
        const skillsXml = fullSkills
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
  fullSkills.map(s => ({
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
        const skillsMd = fullSkills
          .map(
            skill =>
              `- **${skill.name}** [${this.formatSourceType(skill)}] (${this.formatLocation(skill)}): ${skill.description}`,
          )
          .join('\n');
        return `# Available Skills

${skillsMd}`;
      }
    }
  }

  /**
   * Format activated skills based on configured format
   */
  private formatActivatedSkills(): string {
    const skills = this.getSkillsInstance();
    const activatedSkillsList: Skill[] = [];

    for (const name of this.activatedSkills) {
      const skill = skills.get(name);
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
          .map(
            skill =>
              `# Skill: ${skill.name}\nLocation: ${this.formatLocation(skill)}\nSource: ${this.formatSourceType(skill)}\n\n${skill.instructions}`,
          )
          .join('\n\n---\n\n');

        return `<activated_skills>
${skillInstructions}
</activated_skills>`;
      }
      case 'json':
      case 'markdown': {
        const skillInstructions = activatedSkillsList
          .map(
            skill =>
              `# Skill: ${skill.name}\n*Location: ${this.formatLocation(skill)} | Source: ${this.formatSourceType(skill)}*\n\n${skill.instructions}`,
          )
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

  /**
   * Get all allowed tools from activated skills.
   * Returns undefined if no skill specifies allowed tools (no restriction).
   * Returns the union of all allowed tools if any skill specifies them.
   */
  getAllowedTools(): string[] | undefined {
    if (this.skillAllowedTools.size === 0) {
      return undefined; // No restrictions
    }

    // Union of all allowed tools from all activated skills
    const allAllowed = new Set<string>();
    for (const tools of this.skillAllowedTools.values()) {
      for (const tool of tools) {
        allAllowed.add(tool);
      }
    }

    return Array.from(allAllowed);
  }

  // =========================================================================
  // Tool Creation
  // =========================================================================

  /**
   * Create skill-activate tool
   */
  private createSkillActivateTool() {
    const skills = this.getSkillsInstance();

    return createTool({
      id: 'skill-activate',
      description:
        "Activate a skill to load its full instructions. You should activate skills proactively when they are relevant to the user's request without asking for permission first.",
      inputSchema: z.object({
        name: z.string().describe('The name of the skill to activate'),
      }),
      execute: async ({ name }) => {
        // Check if skill exists
        if (!skills.has(name)) {
          const skillNames = skills.list().map(s => s.name);
          return {
            success: false,
            message: `Skill "${name}" not found. Available skills: ${skillNames.join(', ')}`,
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

        // Track allowed tools if specified
        const skill = skills.get(name);
        if (skill?.allowedTools && skill.allowedTools.length > 0) {
          this.skillAllowedTools.set(name, skill.allowedTools);
        }

        // Build response message
        let message = `Skill "${name}" activated successfully. The skill instructions are now available.`;
        if (skill?.allowedTools && skill.allowedTools.length > 0) {
          message += ` This skill pre-approves the following tools: ${skill.allowedTools.join(', ')}.`;
        }

        return {
          success: true,
          message,
          allowedTools: skill?.allowedTools,
        };
      },
    });
  }

  /**
   * Create skill-read-reference tool
   */
  private createSkillReadReferenceTool() {
    const skills = this.getSkillsInstance();

    return createTool({
      id: 'skill-read-reference',
      description:
        'Read a reference file from an activated skill. Optionally specify line range to read a portion of the file.',
      inputSchema: z.object({
        skillName: z.string().describe('The name of the activated skill'),
        referencePath: z.string().describe('Path to the reference file (relative to references/ directory)'),
        startLine: z
          .number()
          .optional()
          .describe('Starting line number (1-indexed). If omitted, starts from the beginning.'),
        endLine: z
          .number()
          .optional()
          .describe('Ending line number (1-indexed, inclusive). If omitted, reads to the end.'),
      }),
      execute: async ({ skillName, referencePath, startLine, endLine }) => {
        // Check if skill is activated
        if (!this.activatedSkills.has(skillName)) {
          return {
            success: false,
            message: `Skill "${skillName}" is not activated. Activate it first using skill-activate.`,
          };
        }

        // Get reference content
        const fullContent = skills.getReference(skillName, referencePath);

        if (fullContent === undefined) {
          const availableRefs = skills.getReferences(skillName);
          return {
            success: false,
            message: `Reference file "${referencePath}" not found in skill "${skillName}". Available references: ${availableRefs.join(', ') || 'none'}`,
          };
        }

        // Extract lines if range specified
        const result = extractLines(fullContent, startLine, endLine);

        return {
          success: true,
          content: result.content,
          lines: result.lines,
          totalLines: result.totalLines,
        };
      },
    });
  }

  /**
   * Create skill-read-script tool
   */
  private createSkillReadScriptTool() {
    const skills = this.getSkillsInstance();

    return createTool({
      id: 'skill-read-script',
      description:
        'Read a script file from an activated skill. Scripts contain executable code. Optionally specify line range.',
      inputSchema: z.object({
        skillName: z.string().describe('The name of the activated skill'),
        scriptPath: z.string().describe('Path to the script file (relative to scripts/ directory)'),
        startLine: z
          .number()
          .optional()
          .describe('Starting line number (1-indexed). If omitted, starts from the beginning.'),
        endLine: z
          .number()
          .optional()
          .describe('Ending line number (1-indexed, inclusive). If omitted, reads to the end.'),
      }),
      execute: async ({ skillName, scriptPath, startLine, endLine }) => {
        // Check if skill is activated
        if (!this.activatedSkills.has(skillName)) {
          return {
            success: false,
            message: `Skill "${skillName}" is not activated. Activate it first using skill-activate.`,
          };
        }

        // Get script content
        const fullContent = skills.getScript(skillName, scriptPath);

        if (fullContent === undefined) {
          const availableScripts = skills.getScripts(skillName);
          return {
            success: false,
            message: `Script file "${scriptPath}" not found in skill "${skillName}". Available scripts: ${availableScripts.join(', ') || 'none'}`,
          };
        }

        // Extract lines if range specified
        const result = extractLines(fullContent, startLine, endLine);

        return {
          success: true,
          content: result.content,
          lines: result.lines,
          totalLines: result.totalLines,
        };
      },
    });
  }

  /**
   * Create skill-read-asset tool
   */
  private createSkillReadAssetTool() {
    const skills = this.getSkillsInstance();

    return createTool({
      id: 'skill-read-asset',
      description:
        'Read an asset file from an activated skill. Assets include templates, data files, and other static resources. Binary files are returned as base64.',
      inputSchema: z.object({
        skillName: z.string().describe('The name of the activated skill'),
        assetPath: z.string().describe('Path to the asset file (relative to assets/ directory)'),
      }),
      execute: async ({ skillName, assetPath }) => {
        // Check if skill is activated
        if (!this.activatedSkills.has(skillName)) {
          return {
            success: false,
            message: `Skill "${skillName}" is not activated. Activate it first using skill-activate.`,
          };
        }

        // Get asset content
        const content = skills.getAsset(skillName, assetPath);

        if (content === undefined) {
          const availableAssets = skills.getAssets(skillName);
          return {
            success: false,
            message: `Asset file "${assetPath}" not found in skill "${skillName}". Available assets: ${availableAssets.join(', ') || 'none'}`,
          };
        }

        // Try to return as string for text files, base64 for binary
        try {
          const textContent = content.toString('utf-8');
          // Check if it looks like valid text (no null bytes in first 1000 chars)
          if (!textContent.slice(0, 1000).includes('\0')) {
            return {
              success: true,
              content: textContent,
              encoding: 'utf-8',
            };
          }
        } catch {
          // Fall through to base64
        }

        return {
          success: true,
          content: content.toString('base64'),
          encoding: 'base64',
        };
      },
    });
  }

  /**
   * Create skill-search tool for searching across skill content
   */
  private createSkillSearchTool() {
    const skills = this.getSkillsInstance();

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
        // Handle both sync and async search results
        const searchResult = skills.search(query, { topK, skillNames });
        const results = Array.isArray(searchResult) ? searchResult : await searchResult;

        if (results.length === 0) {
          return {
            success: true,
            message: 'No results found',
            results: [],
          };
        }

        return {
          success: true,
          results: results.map(
            (r: {
              skillName: string;
              source: string;
              score: number;
              content: string;
              lineRange?: { start: number; end: number };
            }) => ({
              skillName: r.skillName,
              source: r.source,
              score: r.score,
              preview: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
              lineRange: r.lineRange,
            }),
          ),
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
    const skills = this.getSkillsInstance();
    const skillsList = skills.list();
    const hasSkills = skillsList.length > 0;

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

      // 2b. Add allowed-tools notice if any activated skill specifies them
      const allowedTools = this.getAllowedTools();
      if (allowedTools && allowedTools.length > 0) {
        messageList.addSystem({
          role: 'system',
          content: `<skill_allowed_tools>
The following tools are pre-approved by the activated skills: ${allowedTools.join(', ')}.
You may use these tools without asking for additional permission.
</skill_allowed_tools>`,
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
      skillTools['skill-read-script'] = this.createSkillReadScriptTool();
      skillTools['skill-read-asset'] = this.createSkillReadAssetTool();
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
