/**
 * Skill Tools — Factory
 *
 * Creates the built-in skill tools for agents. These tools let the model
 * discover and read skill instructions on demand.
 *
 * Design: stateless. `skill-activate` returns the full skill instructions
 * in its tool result — no activation state tracking needed. Instructions
 * persist naturally in conversation history. If context gets compacted,
 * the model just calls the tool again.
 */

import z from 'zod';

import { createTool } from '../../tools';
import { extractLines } from '../line-utils';
import type { WorkspaceSkills } from './types';

// =============================================================================
// Factory
// =============================================================================

/**
 * Create all skill tools for a workspace with skills.
 * Returns an empty object if the workspace has no skills.
 *
 * Tools are added at the Agent level (like workspace tools), not inside
 * a processor, to avoid losing tool execute functions on serialization.
 */
export function createSkillTools(skills: WorkspaceSkills) {
  return {
    skill: createSkillTool(skills),
    'skill-search': createSkillSearchTool(skills),
    'skill-read-reference': createSkillReadReferenceTool(skills),
    'skill-read-script': createSkillReadScriptTool(skills),
    'skill-read-asset': createSkillReadAssetTool(skills),
  };
}

// =============================================================================
// Individual Tools
// =============================================================================

function createSkillTool(skills: WorkspaceSkills) {
  const tool = createTool({
    id: 'skill',
    description:
      "Activate a skill to load its full instructions. You should activate skills proactively when they are relevant to the user's request without asking for permission first.",
    inputSchema: z.object({
      name: z.string().describe('The name of the skill to activate'),
    }),
    execute: async ({ name }) => {
      const skill = await skills.get(name);

      if (!skill) {
        const skillsList = await skills.list();
        const skillNames = skillsList.map(s => s.name);
        return {
          success: false,
          message: `Skill "${name}" not found. Available skills: ${skillNames.join(', ')}`,
        };
      }

      return {
        success: true,
        name: skill.name,
        description: skill.description,
        location: `${skill.path}/SKILL.md`,
        source: skill.source.type,
        instructions: skill.instructions,
        references: skill.references,
        scripts: skill.scripts,
        assets: skill.assets,
      };
    },
  });

  (tool as any).needsApprovalFn = () => false as const;
  return tool;
}

function createSkillSearchTool(skills: WorkspaceSkills) {
  const tool = createTool({
    id: 'skill-search',
    description:
      'Search across skill content to find relevant information. Useful when you need to find specific details within skills.',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      skillNames: z.array(z.string()).optional().describe('Optional list of skill names to search within'),
      topK: z.number().optional().describe('Maximum number of results to return (default: 5)'),
    }),
    execute: async ({ query, skillNames, topK }) => {
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

  (tool as any).needsApprovalFn = () => false as const;
  return tool;
}

function createSkillReadReferenceTool(skills: WorkspaceSkills) {
  const tool = createTool({
    id: 'skill-read-reference',
    description: 'Read a reference file from a skill. Optionally specify line range to read a portion of the file.',
    inputSchema: z.object({
      skillName: z.string().describe('The name of the skill'),
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
      if (!(await skills.has(skillName))) {
        return {
          success: false,
          message: `Skill "${skillName}" not found.`,
        };
      }

      const fullContent = await skills.getReference(skillName, referencePath);

      if (fullContent === null) {
        const availableRefs = await skills.listReferences(skillName);
        return {
          success: false,
          message: `Reference file "${referencePath}" not found in skill "${skillName}". Available references: ${availableRefs.join(', ') || 'none'}`,
        };
      }

      const result = extractLines(fullContent, startLine, endLine);

      return {
        success: true,
        content: result.content,
        lines: result.lines,
        totalLines: result.totalLines,
      };
    },
  });

  (tool as any).needsApprovalFn = () => false as const;
  return tool;
}

function createSkillReadScriptTool(skills: WorkspaceSkills) {
  const tool = createTool({
    id: 'skill-read-script',
    description: 'Read a script file from a skill. Scripts contain executable code. Optionally specify line range.',
    inputSchema: z.object({
      skillName: z.string().describe('The name of the skill'),
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
      if (!(await skills.has(skillName))) {
        return {
          success: false,
          message: `Skill "${skillName}" not found.`,
        };
      }

      const fullContent = await skills.getScript(skillName, scriptPath);

      if (fullContent === null) {
        const availableScripts = await skills.listScripts(skillName);
        return {
          success: false,
          message: `Script file "${scriptPath}" not found in skill "${skillName}". Available scripts: ${availableScripts.join(', ') || 'none'}`,
        };
      }

      const result = extractLines(fullContent, startLine, endLine);

      return {
        success: true,
        content: result.content,
        lines: result.lines,
        totalLines: result.totalLines,
      };
    },
  });

  (tool as any).needsApprovalFn = () => false as const;
  return tool;
}

function createSkillReadAssetTool(skills: WorkspaceSkills) {
  const tool = createTool({
    id: 'skill-read-asset',
    description:
      'Read an asset file from a skill. Assets include templates, data files, and other static resources. Binary files are returned as base64.',
    inputSchema: z.object({
      skillName: z.string().describe('The name of the skill'),
      assetPath: z
        .string()
        .describe('Path to the asset file (relative to the skill root directory, e.g. "assets/logo.png")'),
    }),
    execute: async ({ skillName, assetPath }) => {
      if (!(await skills.has(skillName))) {
        return {
          success: false,
          message: `Skill "${skillName}" not found.`,
        };
      }

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
        if (!textContent.slice(0, 1000).includes('\0')) {
          return {
            success: true,
            content: textContent,
            encoding: 'utf-8' as const,
          };
        }
      } catch {
        // Fall through to base64
      }

      return {
        success: true,
        content: content.toString('base64'),
        encoding: 'base64' as const,
      };
    },
  });

  (tool as any).needsApprovalFn = () => false as const;
  return tool;
}
