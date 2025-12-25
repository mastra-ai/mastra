import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path, { join } from 'node:path';
import matter from 'gray-matter';
import z from 'zod';
import type { ProcessInputStepArgs, Processor } from '..';
import { createTool } from '../../tools';

// =========================================================================
// Types and Interfaces
// =========================================================================

/**
 * Supported skill format types for system message injection
 */
export type SkillFormat = 'xml' | 'json' | 'markdown';

/**
 * Skill metadata from YAML frontmatter (following Agent Skills spec)
 */
export interface SkillMetadata {
  /** Skill name (1-64 chars, lowercase, hyphens only) */
  name: string;
  /** Description of what the skill does and when to use it (1-1024 chars) */
  description: string;
  /** Optional license */
  license?: string;
  /** Optional compatibility requirements */
  compatibility?: string;
  /** Optional arbitrary metadata */
  metadata?: Record<string, string>;
  /** Optional space-delimited list of pre-approved tools (experimental) */
  allowedTools?: string[];
}

/**
 * Full skill with parsed instructions
 */
export interface Skill extends SkillMetadata {
  /** Absolute path to skill directory */
  path: string;
  /** Markdown body from SKILL.md */
  instructions: string;
}

/**
 * Configuration options for SkillsProcessor
 */
export interface SkillsProcessorOptions {
  /** Path or paths to directories containing skills (default: ./skills) */
  skillsPaths?: string | string[];
  /** Format for skill injection (default: 'xml') */
  format?: SkillFormat;
  /** Allow script execution (default: false) */
  allowScriptExecution?: boolean;
  /** Validate skills on load (default: true) */
  validateSkills?: boolean;
}

// =========================================================================
// Validation Schemas
// =========================================================================

/**
 * Skill name schema according to spec:
 * - 1-64 characters
 * - Lowercase letters, numbers, hyphens only
 * - Must not start or end with hyphen
 * - Must not contain consecutive hyphens
 */
const SkillNameSchema = z
  .string()
  .min(1, 'Skill name cannot be empty')
  .max(64, 'Skill name must be 64 characters or less')
  .regex(/^[a-z0-9-]+$/, 'Skill name must contain only lowercase letters, numbers, and hyphens')
  .refine(name => !name.startsWith('-') && !name.endsWith('-'), {
    message: 'Skill name must not start or end with a hyphen',
  })
  .refine(name => !name.includes('--'), {
    message: 'Skill name must not contain consecutive hyphens',
  })
  .describe('Skill name (1-64 chars, lowercase letters/numbers/hyphens only, must match directory name)');

/**
 * Skill description schema according to spec (1-1024 chars, non-empty)
 */
const SkillDescriptionSchema = z
  .string()
  .min(1, 'Skill description cannot be empty')
  .max(1024, 'Skill description must be 1024 characters or less')
  .refine(desc => desc.trim().length > 0, {
    message: 'Skill description cannot be only whitespace',
  })
  .describe('Description of what the skill does and when to use it (1-1024 characters)');

/**
 * Skill metadata schema
 */
const SkillMetadataSchema = z.object({
  name: SkillNameSchema,
  description: SkillDescriptionSchema,
  license: z.string().optional().describe('License for the skill (e.g., "Apache-2.0", "MIT")'),
  compatibility: z
    .string()
    .max(500, 'Compatibility field must be 500 characters or less')
    .optional()
    .describe('Environment requirements or compatibility notes (max 500 chars)'),
  metadata: z.record(z.string()).optional().describe('Arbitrary key-value metadata (e.g., author, version)'),
  allowedTools: z.array(z.string()).optional().describe('Space-delimited list of pre-approved tools (experimental)'),
});

/**
 * Validate skill metadata using Zod schema
 */
function validateSkillMetadata(metadata: SkillMetadata, dirName: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate against schema
  const result = SkillMetadataSchema.safeParse(metadata);
  if (!result.success) {
    errors.push(...result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`));
  }

  // Validate name matches directory
  if (metadata.name !== dirName) {
    errors.push(`Skill name "${metadata.name}" must match directory name "${dirName}"`);
  }

  return { valid: errors.length === 0, errors };
}

// =========================================================================
// Parsing
// =========================================================================

/**
 * Parse SKILL.md file and extract metadata + instructions
 */
function parseSkillFile(filePath: string, dirName: string, validate: boolean = true): Skill {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    const frontmatter = parsed.data;
    const body = parsed.content.trim();

    // Extract required fields
    const metadata: SkillMetadata = {
      name: frontmatter.name,
      description: frontmatter.description,
      license: frontmatter.license,
      compatibility: frontmatter.compatibility,
      metadata: frontmatter.metadata,
      allowedTools: Array.isArray(frontmatter.allowedTools)
        ? frontmatter.allowedTools
        : typeof frontmatter.allowedTools === 'string'
          ? frontmatter.allowedTools.split(/\s+/)
          : undefined,
    };

    // Validate if enabled
    if (validate) {
      const validation = validateSkillMetadata(metadata, dirName);
      if (!validation.valid) {
        throw new Error(`Invalid skill metadata in ${filePath}:\n${validation.errors.join('\n')}`);
      }
    }

    const skillPath = filePath.substring(0, filePath.lastIndexOf('/'));

    return {
      ...metadata,
      path: skillPath,
      instructions: body,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

// =========================================================================
// SkillsProcessor
// =========================================================================

/**
 * Processor for Agent Skills specification
 * Discovers skills from filesystem and makes them available to agents
 */
export class SkillsProcessor implements Processor {
  readonly id = 'skills-processor';
  readonly name = 'Skills Processor';

  private skillsMetadata: Map<string, SkillMetadata> = new Map();
  private activatedSkills: Map<string, Skill> = new Map();
  private skillsPaths: string[];
  private format: SkillFormat;
  private validateSkills: boolean;

  constructor(opts?: SkillsProcessorOptions) {
    if (opts?.skillsPaths === undefined) {
      this.skillsPaths = [path.resolve(process.cwd(), '../../skills')];
    } else {
      this.skillsPaths = Array.isArray(opts.skillsPaths) ? opts.skillsPaths : [opts.skillsPaths];
    }
    this.format = opts?.format ?? 'xml';
    this.validateSkills = opts?.validateSkills ?? true;

    // Discover skills at construction time
    this.discoverSkills();
  }

  /**
   * Scan configured directories for skills and load metadata
   */
  private discoverSkills(): void {
    for (const skillsPath of this.skillsPaths) {
      if (!existsSync(skillsPath)) {
        console.warn(`[SkillsProcessor] Skills path does not exist: ${skillsPath}`);
        continue;
      }

      try {
        const entries = readdirSync(skillsPath);

        for (const entry of entries) {
          const entryPath = join(skillsPath, entry);
          const stat = statSync(entryPath);

          if (stat.isDirectory()) {
            const skillFilePath = join(entryPath, 'SKILL.md');

            if (existsSync(skillFilePath)) {
              try {
                const skill = parseSkillFile(skillFilePath, entry, this.validateSkills);

                // Check for duplicate names
                if (this.skillsMetadata.has(skill.name)) {
                  console.warn(
                    `[SkillsProcessor] Duplicate skill name "${skill.name}" found in ${skillFilePath}. Last one wins.`,
                  );
                }

                // Store only metadata for now (progressive disclosure)
                this.skillsMetadata.set(skill.name, {
                  name: skill.name,
                  description: skill.description,
                  license: skill.license,
                  compatibility: skill.compatibility,
                  metadata: skill.metadata,
                  allowedTools: skill.allowedTools,
                });
              } catch (error) {
                if (error instanceof Error) {
                  console.error(`[SkillsProcessor] Failed to load skill from ${skillFilePath}:`, error.message);
                }
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(`[SkillsProcessor] Failed to scan skills directory ${skillsPath}:`, error.message);
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(`[SkillsProcessor] Discovered ${this.skillsMetadata.size} skills`);
  }

  /**
   * Format available skills metadata based on configured format
   */
  private formatAvailableSkills(): string {
    const skills = Array.from(this.skillsMetadata.values());

    switch (this.format) {
      case 'xml':
        return this.formatSkillsAsXml(skills);
      case 'json':
        return this.formatSkillsAsJson(skills);
      case 'markdown':
        return this.formatSkillsAsMarkdown(skills);
    }
  }

  private formatSkillsAsXml(skills: SkillMetadata[]): string {
    if (skills.length === 0) return '';

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

  private formatSkillsAsJson(skills: SkillMetadata[]): string {
    if (skills.length === 0) return '';

    return `Available Skills:

${JSON.stringify(
  skills.map(s => ({ name: s.name, description: s.description })),
  null,
  2,
)}`;
  }

  private formatSkillsAsMarkdown(skills: SkillMetadata[]): string {
    if (skills.length === 0) return '';

    const skillsMd = skills.map(skill => `- **${skill.name}**: ${skill.description}`).join('\n');

    return `# Available Skills

${skillsMd}`;
  }

  /**
   * Format activated skills based on configured format
   */
  private formatActivatedSkills(): string {
    const skills = Array.from(this.activatedSkills.values());

    switch (this.format) {
      case 'xml':
        return this.formatActivatedSkillsAsXml(skills);
      case 'json':
      case 'markdown':
        return this.formatActivatedSkillsAsMarkdown(skills);
    }
  }

  private formatActivatedSkillsAsXml(skills: Skill[]): string {
    const skillInstructions = skills
      .map(skill => `# Skill: ${skill.name}\n\n${skill.instructions}`)
      .join('\n\n---\n\n');

    return `<activated_skills>
${skillInstructions}
</activated_skills>`;
  }

  private formatActivatedSkillsAsMarkdown(skills: Skill[]): string {
    const skillInstructions = skills
      .map(skill => `# Skill: ${skill.name}\n\n${skill.instructions}`)
      .join('\n\n---\n\n');

    return `# Activated Skills

${skillInstructions}`;
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
        if (!this.skillsMetadata.has(name)) {
          return {
            success: false,
            message: `Skill "${name}" not found. Available skills: ${Array.from(this.skillsMetadata.keys()).join(', ')}`,
          };
        }

        // Check if already activated
        if (this.activatedSkills.has(name)) {
          return {
            success: true,
            message: `Skill "${name}" is already activated`,
          };
        }

        // Load full skill
        try {
          // Find skill file
          let skillFilePath: string | null = null;
          for (const skillsPath of this.skillsPaths) {
            const candidatePath = join(skillsPath, name, 'SKILL.md');
            if (existsSync(candidatePath)) {
              skillFilePath = candidatePath;
              break;
            }
          }

          if (!skillFilePath) {
            return {
              success: false,
              message: `Skill "${name}" metadata found but SKILL.md file not found`,
            };
          }

          const skill = parseSkillFile(skillFilePath, name, this.validateSkills);
          this.activatedSkills.set(name, skill);

          return {
            success: true,
            message: `Skill "${name}" activated successfully. The skill instructions are now available.`,
          };
        } catch (error) {
          if (error instanceof Error) {
            return {
              success: false,
              message: `Failed to activate skill "${name}": ${error.message}`,
            };
          }
          return {
            success: false,
            message: `Failed to activate skill "${name}": Unknown error`,
          };
        }
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
        const skill = this.activatedSkills.get(skillName);
        if (!skill) {
          return {
            success: false,
            message: `Skill "${skillName}" is not activated. Activate it first using skill-activate.`,
          };
        }

        // Construct reference file path
        const refFilePath = join(skill.path, 'references', referencePath);

        if (!existsSync(refFilePath)) {
          return {
            success: false,
            message: `Reference file "${referencePath}" not found in skill "${skillName}"`,
          };
        }

        try {
          const content = readFileSync(refFilePath, 'utf-8');
          return {
            success: true,
            content,
          };
        } catch (error) {
          if (error instanceof Error) {
            return {
              success: false,
              message: `Failed to read reference file: ${error.message}`,
            };
          }
          return {
            success: false,
            message: 'Failed to read reference file: Unknown error',
          };
        }
      },
    });
  }

  /**
   * Process input step - inject available skills and provide skill tools
   */
  async processInputStep({ messageList, tools }: ProcessInputStepArgs) {
    // 1. Inject available skills metadata (if any skills discovered)
    if (this.skillsMetadata.size > 0) {
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

    // 3. Add skill tools
    let skillTools: Record<string, any> = {
      'skill-activate': this.createSkillActivateTool(),
    };

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
