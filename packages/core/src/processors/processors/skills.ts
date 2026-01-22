/**
 * SkillsProcessor - Processor for Agent Skills specification.
 *
 * Makes skills available to agents via tools and system message injection.
 * This processor works with Workspace.skills to discover and activate skills.
 *
 * @example
 * ```typescript
 * // Auto-created by Agent when workspace has skillsPaths
 * const agent = new Agent({
 *   workspace: new Workspace({
 *     filesystem: new LocalFilesystem({ basePath: './data' }),
 *     skillsPaths: ['/skills'],
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

import z from 'zod';

import { createTool } from '../../tools';
import { extractLines } from '../../workspace/line-utils';
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
 * Makes skills available to agents via tools and system message injection.
 */
export class SkillsProcessor implements Processor<'skills-processor'> {
  readonly id = 'skills-processor' as const;
  readonly name = 'Skills Processor';

  /** Workspace instance */
  private readonly _workspace: Workspace;

  /** Format for skill injection */
  private readonly _format: SkillFormat;

  /** Set of activated skill names */
  private _activatedSkills: Set<string> = new Set();

  /** Map of skill name -> allowed tools (only for skills with allowedTools defined) */
  private _skillAllowedTools: Map<string, string[]> = new Map();

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
      allowedTools?: string[];
    }>
  > {
    const skillsList = await this.skills?.list();
    if (!skillsList) return [];

    return skillsList.map(skill => ({
      name: skill.name,
      description: skill.description,
      license: skill.license,
      allowedTools: skill.allowedTools,
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
   * Format available skills metadata based on configured format
   */
  private async formatAvailableSkills(): Promise<string> {
    const skillsList = await this.skills?.list();
    if (!skillsList || skillsList.length === 0) {
      return '';
    }

    // Get full skill objects to include source info
    const fullSkills: Skill[] = [];
    for (const meta of skillsList) {
      const skill = await this.skills?.get(meta.name);
      if (skill) {
        fullSkills.push(skill);
      }
    }

    switch (this._format) {
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
  private async formatActivatedSkills(): Promise<string> {
    const activatedSkillsList: Skill[] = [];

    for (const name of this._activatedSkills) {
      const skill = await this.skills?.get(name);
      if (skill) {
        activatedSkillsList.push(skill);
      }
    }

    if (activatedSkillsList.length === 0) {
      return '';
    }

    switch (this._format) {
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
    if (this._skillAllowedTools.size === 0) {
      return undefined; // No restrictions
    }

    // Union of all allowed tools from all activated skills
    const allAllowed = new Set<string>();
    for (const tools of this._skillAllowedTools.values()) {
      for (const tool of tools) {
        allAllowed.add(tool);
      }
    }

    return Array.from(allAllowed);
  }

  // ===========================================================================
  // Tool Creation
  // ===========================================================================

  /**
   * Create skill-activate tool
   */
  private createSkillActivateTool() {
    const skills = this.skills;
    const activatedSkills = this._activatedSkills;
    const skillAllowedTools = this._skillAllowedTools;

    return createTool({
      id: 'skill-activate',
      description:
        "Activate a skill to load its full instructions. You should activate skills proactively when they are relevant to the user's request without asking for permission first.",
      inputSchema: z.object({
        name: z.string().describe('The name of the skill to activate'),
      }),
      execute: async ({ name }) => {
        if (!skills) {
          return {
            success: false,
            message: 'No skills configured',
          };
        }

        // Check if skill exists
        if (!(await skills.has(name))) {
          const skillsList = await skills.list();
          const skillNames = skillsList.map(s => s.name);
          return {
            success: false,
            message: `Skill "${name}" not found. Available skills: ${skillNames.join(', ')}`,
          };
        }

        // Check if already activated
        if (activatedSkills.has(name)) {
          return {
            success: true,
            message: `Skill "${name}" is already activated`,
          };
        }

        // Activate the skill
        activatedSkills.add(name);

        // Track allowed tools if specified
        const skill = await skills.get(name);
        if (skill?.allowedTools && skill.allowedTools.length > 0) {
          skillAllowedTools.set(name, skill.allowedTools);
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
    const skills = this.skills;
    const activatedSkills = this._activatedSkills;

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
        if (!skills) {
          return {
            success: false,
            message: 'No skills configured',
          };
        }

        // Check if skill is activated
        if (!activatedSkills.has(skillName)) {
          return {
            success: false,
            message: `Skill "${skillName}" is not activated. Activate it first using skill-activate.`,
          };
        }

        // Get reference content
        const fullContent = await skills.getReference(skillName, referencePath);

        if (fullContent === null) {
          const availableRefs = await skills.listReferences(skillName);
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
    const skills = this.skills;
    const activatedSkills = this._activatedSkills;

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
        if (!skills) {
          return {
            success: false,
            message: 'No skills configured',
          };
        }

        // Check if skill is activated
        if (!activatedSkills.has(skillName)) {
          return {
            success: false,
            message: `Skill "${skillName}" is not activated. Activate it first using skill-activate.`,
          };
        }

        // Get script content
        const fullContent = await skills.getScript(skillName, scriptPath);

        if (fullContent === null) {
          const availableScripts = await skills.listScripts(skillName);
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
    const skills = this.skills;
    const activatedSkills = this._activatedSkills;

    return createTool({
      id: 'skill-read-asset',
      description:
        'Read an asset file from an activated skill. Assets include templates, data files, and other static resources. Binary files are returned as base64.',
      inputSchema: z.object({
        skillName: z.string().describe('The name of the activated skill'),
        assetPath: z.string().describe('Path to the asset file (relative to assets/ directory)'),
      }),
      execute: async ({ skillName, assetPath }) => {
        if (!skills) {
          return {
            success: false,
            message: 'No skills configured',
          };
        }

        // Check if skill is activated
        if (!activatedSkills.has(skillName)) {
          return {
            success: false,
            message: `Skill "${skillName}" is not activated. Activate it first using skill-activate.`,
          };
        }

        // Get asset content
        const content = await skills.getAsset(skillName, assetPath);

        if (content === null) {
          const availableAssets = await skills.listAssets(skillName);
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
    const skills = this.skills;

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
        if (!skills) {
          return {
            success: true,
            message: 'No skills configured',
            results: [],
          };
        }

        const results = await skills.search(query, { topK, skillNames });

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
            lineRange: r.lineRange,
          })),
        };
      },
    });
  }

  // ===========================================================================
  // Processor Interface
  // ===========================================================================

  /**
   * Process input step - inject available skills and provide skill tools
   */
  async processInputStep({ messageList, tools, stepNumber }: ProcessInputStepArgs) {
    // Refresh skills on first step only (not every step in the agentic loop)
    if (stepNumber === 0) {
      await this.skills?.maybeRefresh();
    }
    const skillsList = await this.skills?.list();
    const hasSkills = skillsList && skillsList.length > 0;

    // 1. Inject available skills metadata (if any skills discovered)
    if (hasSkills) {
      const availableSkillsMessage = await this.formatAvailableSkills();
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
    if (this._activatedSkills.size > 0) {
      const activatedSkillsMessage = await this.formatActivatedSkills();
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

    // 3. Build skill tools (typed as Record<string, unknown> to match ProcessInputStepResult)
    const skillTools: Record<string, unknown> = {};

    if (hasSkills) {
      skillTools['skill-activate'] = this.createSkillActivateTool();
      skillTools['skill-search'] = this.createSkillSearchTool();
    }

    if (this._activatedSkills.size > 0) {
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
