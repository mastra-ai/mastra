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
import type { Skill, WorkspaceSkills } from './types';

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

/**
 * Resolve a skill identifier (name or path) to a Skill.
 * If the identifier matches a path exactly, use it directly.
 * If it matches a single skill by name, use that.
 * If multiple skills share the same name, return a disambiguation message.
 */
async function resolveSkill(
  skills: WorkspaceSkills,
  identifier: string,
): Promise<{ skill: Skill } | { disambiguation: string } | { notFound: string }> {
  // Try exact path match first
  const byPath = await skills.get(identifier);
  if (byPath) return { skill: byPath };

  // Fall back to name-based lookup
  const allSkills = await skills.list();
  const matches = allSkills.filter(s => s.name === identifier);

  if (matches.length === 1) {
    const skill = await skills.get(matches[0]!.path);
    if (skill) return { skill };
  }

  if (matches.length > 1) {
    const listing = matches.map(s => `  - "${s.path}" (${s.name})`).join('\n');
    return {
      disambiguation: `Multiple skills named "${identifier}" found. Please call again with the specific path:\n${listing}`,
    };
  }

  const skillNames = allSkills.map(s => s.name);
  return { notFound: `Skill "${identifier}" not found. Available skills: ${skillNames.join(', ')}` };
}

function createSkillTool(skills: WorkspaceSkills) {
  const tool = createTool({
    id: 'skill',
    description:
      "Activate a skill to load its full instructions. You should activate skills proactively when they are relevant to the user's request without asking for permission first.",
    inputSchema: z.object({
      name: z
        .string()
        .describe('The name or path of the skill to activate. Use the path when multiple skills share the same name.'),
    }),
    execute: async ({ name }) => {
      const result = await resolveSkill(skills, name);

      if ('notFound' in result) return result.notFound;
      if ('disambiguation' in result) return result.disambiguation;

      const { skill } = result;
      const parts = [skill.instructions];

      if (skill.references?.length) {
        parts.push(`\n\n## References\n${skill.references.map(r => `- references/${r}`).join('\n')}`);
      }
      if (skill.scripts?.length) {
        parts.push(`\n\n## Scripts\n${skill.scripts.map(s => `- scripts/${s}`).join('\n')}`);
      }
      if (skill.assets?.length) {
        parts.push(`\n\n## Assets\n${skill.assets.map(a => `- assets/${a}`).join('\n')}`);
      }

      return parts.join('');
    },
  });

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
      // Map skill names to paths for the search API
      let skillPaths: string[] | undefined;
      if (skillNames) {
        const allSkills = await skills.list();
        skillPaths = allSkills.filter(s => skillNames.includes(s.name)).map(s => s.path);
      }

      const results = await skills.search(query, { topK, skillPaths });

      if (results.length === 0) {
        return 'No results found.';
      }

      return results
        .map(r => {
          const preview = r.content.substring(0, 200) + (r.content.length > 200 ? '...' : '');
          const location = r.lineRange ? ` (lines ${r.lineRange.start}-${r.lineRange.end})` : '';
          return `[${r.skillPath}]${location} (score: ${r.score.toFixed(2)})\n${preview}`;
        })
        .join('\n\n');
    },
  });

  return tool;
}

function createSkillReadTool(skills: WorkspaceSkills) {
  const tool = createTool({
    id: 'skill_read',
    description:
      'Read a file from a skill directory (references, scripts, or assets). The path is relative to the skill root.',
    inputSchema: z.object({
      skillName: z
        .string()
        .describe('The name or path of the skill. Use the path when multiple skills share the same name.'),
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
      // Resolve skill by name or path
      const resolved = await resolveSkill(skills, skillName);
      if ('notFound' in resolved) return resolved.notFound;
      if ('disambiguation' in resolved) return resolved.disambiguation;

      const resolvedPath = resolved.skill.path;

      // Try each reader — they all do the same thing (resolve path + readFile)
      let content: string | Buffer | null = null;
      content = await skills.getReference(resolvedPath, path);
      if (content === null) content = await skills.getScript(resolvedPath, path);
      if (content === null) content = await skills.getAsset(resolvedPath, path);

      if (content === null) {
        const refs = (await skills.listReferences(resolvedPath)).map(f => `references/${f}`);
        const scriptsList = (await skills.listScripts(resolvedPath)).map(f => `scripts/${f}`);
        const assets = (await skills.listAssets(resolvedPath)).map(f => `assets/${f}`);
        const allFiles = [...refs, ...scriptsList, ...assets];
        const fileList = allFiles.length > 0 ? `\nAvailable files: ${allFiles.join(', ')}` : '';
        return `File "${path}" not found in skill "${skillName}".${fileList}`;
      }

      // Detect binary content — getReference/getScript may return binary as garbled utf-8 strings
      const textContent = typeof content === 'string' ? content : content.toString('utf-8');
      if (textContent.slice(0, 1000).includes('\0')) {
        const skill = await skills.get(resolvedPath);
        const fullPath = skill ? `${skill.path}/${path}` : path;
        const size = typeof content === 'string' ? Buffer.byteLength(content) : content.length;
        return `Binary file: ${fullPath} (${size} bytes)`;
      }
      content = textContent;

      const result = extractLines(content, startLine, endLine);
      return result.content;
    },
  });

  return tool;
}
