/**
 * Skill Tools — Factory
 *
 * Creates the built-in skill tools for agents. These tools let the model
 * discover and read skill instructions on demand.
 *
 * Design: stateless. The `skill` tool returns the full skill instructions
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
    skill_search: createSkillSearchTool(skills),
    skill_read: createSkillReadTool(skills),
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
        return `Skill "${name}" not found. Available skills: ${skillNames.join(', ')}`;
      }

      const parts = [`# Skill: ${skill.name}\n\n${skill.instructions}`];

      if (skill.references?.length) {
        parts.push(`\n\n## References\n${skill.references.map(r => `- ${r}`).join('\n')}`);
      }
      if (skill.scripts?.length) {
        parts.push(`\n\n## Scripts\n${skill.scripts.map(s => `- ${s}`).join('\n')}`);
      }
      if (skill.assets?.length) {
        parts.push(`\n\n## Assets\n${skill.assets.map(a => `- ${a}`).join('\n')}`);
      }

      return parts.join('');
    },
  });

  (tool as any).needsApprovalFn = () => false as const;
  return tool;
}

function createSkillSearchTool(skills: WorkspaceSkills) {
  const tool = createTool({
    id: 'skill_search',
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
        return 'No results found.';
      }

      return results
        .map(r => {
          const preview = r.content.substring(0, 200) + (r.content.length > 200 ? '...' : '');
          const location = r.lineRange ? ` (lines ${r.lineRange.start}-${r.lineRange.end})` : '';
          return `[${r.skillName}]${location} (score: ${r.score.toFixed(2)})\n${preview}`;
        })
        .join('\n\n');
    },
  });

  (tool as any).needsApprovalFn = () => false as const;
  return tool;
}

function createSkillReadTool(skills: WorkspaceSkills) {
  const tool = createTool({
    id: 'skill_read',
    description:
      'Read a file from a skill directory (references, scripts, or assets). The path is relative to the skill root.',
    inputSchema: z.object({
      skillName: z.string().describe('The name of the skill'),
      path: z
        .string()
        .describe('Path to the file relative to the skill root (e.g. "references/colors.md", "scripts/run.sh")'),
      startLine: z
        .number()
        .optional()
        .describe('Starting line number (1-indexed). If omitted, starts from the beginning.'),
      endLine: z
        .number()
        .optional()
        .describe('Ending line number (1-indexed, inclusive). If omitted, reads to the end.'),
    }),
    execute: async ({ skillName, path, startLine, endLine }) => {
      if (!(await skills.has(skillName))) {
        return `Skill "${skillName}" not found.`;
      }

      // Route to the appropriate reader based on path prefix
      const normalizedPath = path.replace(/\\/g, '/');
      let content: string | Buffer | null = null;
      let availableFiles: string[] = [];

      if (normalizedPath.startsWith('references/') || normalizedPath.startsWith('references\\')) {
        content = await skills.getReference(skillName, path);
        if (content === null) {
          availableFiles = (await skills.listReferences(skillName)).map(f => `references/${f}`);
        }
      } else if (normalizedPath.startsWith('scripts/') || normalizedPath.startsWith('scripts\\')) {
        content = await skills.getScript(skillName, path);
        if (content === null) {
          availableFiles = (await skills.listScripts(skillName)).map(f => `scripts/${f}`);
        }
      } else if (normalizedPath.startsWith('assets/') || normalizedPath.startsWith('assets\\')) {
        content = await skills.getAsset(skillName, path);
        if (content === null) {
          availableFiles = (await skills.listAssets(skillName)).map(f => `assets/${f}`);
        }
      } else {
        // Try each type in order
        content = await skills.getReference(skillName, path);
        if (content === null) content = await skills.getScript(skillName, path);
        if (content === null) content = await skills.getAsset(skillName, path);

        if (content === null) {
          const refs = (await skills.listReferences(skillName)).map(f => `references/${f}`);
          const scripts = (await skills.listScripts(skillName)).map(f => `scripts/${f}`);
          const assets = (await skills.listAssets(skillName)).map(f => `assets/${f}`);
          availableFiles = [...refs, ...scripts, ...assets];
        }
      }

      if (content === null) {
        const fileList = availableFiles.length > 0 ? `\nAvailable files: ${availableFiles.join(', ')}` : '';
        return `File "${path}" not found in skill "${skillName}".${fileList}`;
      }

      // Convert Buffer to string for text display
      const textContent = typeof content === 'string' ? content : content.toString('base64');
      const isBase64 = typeof content !== 'string';

      if (isBase64) {
        return `[base64 encoded]\n${textContent}`;
      }

      const result = extractLines(textContent, startLine, endLine);
      return result.content;
    },
  });

  (tool as any).needsApprovalFn = () => false as const;
  return tool;
}
