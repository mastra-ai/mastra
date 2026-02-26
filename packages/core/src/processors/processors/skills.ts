/**
 * SkillsProcessor - Processor for Agent Skills specification.
 *
 * Makes skills available to agents via tools and system message injection.
 * This processor works with Workspace.skills to discover and activate skills.
 *
 * @example
 * ```typescript
 * // Auto-created by Agent when workspace has skills
 * const agent = new Agent({
 *   workspace: new Workspace({
 *     filesystem: new LocalFilesystem({ basePath: './data' }),
 *     skills: ['/skills'],
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
   * Format available skills metadata based on configured format
   */
  private async formatAvailableSkills(): Promise<string> {
    const skillsList = await this.skills?.list();
    if (!skillsList || skillsList.length === 0) {
      return '';
    }

    // Get full skill objects to include source info (parallel fetch)
    const skillPromises = skillsList.map(meta => this.skills?.get(meta.name));
    const fullSkills = (await Promise.all(skillPromises)).filter((s): s is Skill => s !== undefined);

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

      default: {
        const _exhaustive: never = this._format;
        return _exhaustive;
      }
    }
  }

  /**
   * Format activated skills based on configured format
   */
  private async formatActivatedSkills(): Promise<string> {
    const skillPromises = Array.from(this._activatedSkills).map(name => this.skills?.get(name));
    const activatedSkillsList = (await Promise.all(skillPromises)).filter((s): s is Skill => s !== undefined);

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
  // Tool Creation
  // ===========================================================================

  /**
   * Create skill-activate tool
   */
  private createSkillActivateTool() {
    const skills = this.skills;
    const activatedSkills = this._activatedSkills;

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
    const skills = this.skills;
    const activatedSkills = this._activatedSkills;

    return createTool({
      id: 'skill-read-reference',
      description:
        'Read a reference file from an activated skill. Optionally specify line range to read a portion of the file.',
      inputSchema: z.object({
        skillName: z.string().describe('The name of the activated skill'),
        referencePath: z
          .string()
          .describe(
            'Path to the reference file (relative to the skill root directory, e.g. "references/colors.md" or "docs/schema.md")',
          ),
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
        scriptPath: z
          .string()
          .describe('Path to the script file (relative to the skill root directory, e.g. "scripts/run.sh")'),
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
        assetPath: z
          .string()
          .describe('Path to the asset file (relative to the skill root directory, e.g. "assets/logo.png")'),
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
            success: false,
            message: 'No skills configured',
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
  // Helpers
  // ===========================================================================

  /**
   * Mark a tool as never requiring approval.
   * Skill tools are internal plumbing and should bypass requireToolApproval.
   */
  private withNoApproval<T extends object>(tool: T): T & { needsApprovalFn: () => false } {
    (tool as any).needsApprovalFn = () => false as const;
    return tool as T & { needsApprovalFn: () => false };
  }

  // ===========================================================================
  // Processor Interface
  // ===========================================================================

  /**
   * Process input step - inject available skills and provide skill tools
   */
  async processInputStep({ messageList, tools, stepNumber, requestContext }: ProcessInputStepArgs) {
    // Refresh skills on first step only (not every step in the agentic loop)
    if (stepNumber === 0) {
      await this.skills?.maybeRefresh({ requestContext });
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
      // Be explicit that skills are NOT tools and must be activated via skill-activate
      messageList.addSystem({
        role: 'system',
        content:
          'IMPORTANT: Skills are NOT tools. Do not call skill names directly. ' +
          'To use a skill, call the skill-activate tool with the skill name as the "name" parameter. ' +
          'When a user asks about a topic covered by an available skill, activate it immediately without asking for permission.',
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
    }

    // 3. Build skill tools (typed as Record<string, unknown> to match ProcessInputStepResult)
    const skillTools: Record<string, unknown> = {};

    if (hasSkills) {
      skillTools['skill-activate'] = this.withNoApproval(this.createSkillActivateTool());
      skillTools['skill-search'] = this.withNoApproval(this.createSkillSearchTool());
    }

    if (this._activatedSkills.size > 0) {
      skillTools['skill-read-reference'] = this.withNoApproval(this.createSkillReadReferenceTool());
      skillTools['skill-read-script'] = this.withNoApproval(this.createSkillReadScriptTool());
      skillTools['skill-read-asset'] = this.withNoApproval(this.createSkillReadAssetTool());
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
