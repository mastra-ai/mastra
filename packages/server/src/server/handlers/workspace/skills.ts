/**
 * Workspace Skills Handlers
 *
 * Provides REST API for workspace skills operations.
 * Skills are now accessed via workspace.skills instead of a standalone Skills class.
 */

import type { WorkspaceSkills } from '@mastra/core/workspace';
import { HTTPException } from '../../http-exception';
import { createRoute } from '../../server-adapter/routes/route-builder';
import { handleError } from '../error';
import {
  skillNamePathParams,
  skillReferencePathParams,
  searchSkillsQuerySchema,
  listSkillsResponseSchema,
  getSkillResponseSchema,
  skillReferenceResponseSchema,
  listReferencesResponseSchema,
  searchSkillsResponseSchema,
} from './schemas';

/**
 * Get the skills instance from Mastra's workspace.
 * Returns undefined if no workspace or skills are configured.
 */
function getSkills(mastra: any): WorkspaceSkills | undefined {
  return mastra.getWorkspace?.()?.skills;
}

// =============================================================================
// Skills Routes (under /api/workspace/skills)
// =============================================================================

export const WORKSPACE_LIST_SKILLS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workspace/skills',
  responseType: 'json',
  responseSchema: listSkillsResponseSchema,
  summary: 'List all skills',
  description: 'Returns a list of all discovered skills with their metadata',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra }) => {
    try {
      const skills = getSkills(mastra);
      if (!skills) {
        return { skills: [], isSkillsConfigured: false };
      }

      const skillsList = await skills.list();

      return {
        skills: skillsList.map(skill => ({
          name: skill.name,
          description: skill.description,
          license: skill.license,
          compatibility: skill.compatibility,
          metadata: skill.metadata,
          allowedTools: skill.allowedTools,
        })),
        isSkillsConfigured: true,
      };
    } catch (error) {
      return handleError(error, 'Error listing skills');
    }
  },
});

export const WORKSPACE_GET_SKILL_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workspace/skills/:skillName',
  responseType: 'json',
  pathParamSchema: skillNamePathParams,
  responseSchema: getSkillResponseSchema,
  summary: 'Get skill details',
  description: 'Returns the full details of a specific skill including instructions and file lists',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, skillName }) => {
    try {
      if (!skillName) {
        throw new HTTPException(400, { message: 'Skill name is required' });
      }

      const skills = getSkills(mastra);
      if (!skills) {
        throw new HTTPException(404, { message: 'No workspace with skills configured' });
      }

      const skill = await skills.get(skillName);
      if (!skill) {
        throw new HTTPException(404, { message: `Skill "${skillName}" not found` });
      }

      return {
        name: skill.name,
        description: skill.description,
        license: skill.license,
        compatibility: skill.compatibility,
        metadata: skill.metadata,
        allowedTools: skill.allowedTools,
        path: skill.path,
        instructions: skill.instructions,
        source: skill.source,
        references: skill.references,
        scripts: skill.scripts,
        assets: skill.assets,
      };
    } catch (error) {
      return handleError(error, 'Error getting skill');
    }
  },
});

export const WORKSPACE_LIST_SKILL_REFERENCES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workspace/skills/:skillName/references',
  responseType: 'json',
  pathParamSchema: skillNamePathParams,
  responseSchema: listReferencesResponseSchema,
  summary: 'List skill references',
  description: 'Returns a list of all reference file paths for a skill',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, skillName }) => {
    try {
      if (!skillName) {
        throw new HTTPException(400, { message: 'Skill name is required' });
      }

      const skills = getSkills(mastra);
      if (!skills) {
        throw new HTTPException(404, { message: 'No workspace with skills configured' });
      }

      const hasSkill = await skills.has(skillName);
      if (!hasSkill) {
        throw new HTTPException(404, { message: `Skill "${skillName}" not found` });
      }

      const references = await skills.listReferences(skillName);

      return {
        skillName,
        references,
      };
    } catch (error) {
      return handleError(error, 'Error listing skill references');
    }
  },
});

export const WORKSPACE_GET_SKILL_REFERENCE_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workspace/skills/:skillName/references/:referencePath',
  responseType: 'json',
  pathParamSchema: skillReferencePathParams,
  responseSchema: skillReferenceResponseSchema,
  summary: 'Get skill reference content',
  description: 'Returns the content of a specific reference file from a skill',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, skillName, referencePath }) => {
    try {
      if (!skillName || !referencePath) {
        throw new HTTPException(400, { message: 'Skill name and reference path are required' });
      }

      const skills = getSkills(mastra);
      if (!skills) {
        throw new HTTPException(404, { message: 'No workspace with skills configured' });
      }

      // Decode the reference path (it may be URL encoded)
      const decodedPath = decodeURIComponent(referencePath);

      const content = await skills.getReference(skillName, decodedPath);
      if (content === null) {
        throw new HTTPException(404, { message: `Reference "${decodedPath}" not found in skill "${skillName}"` });
      }

      return {
        skillName,
        referencePath: decodedPath,
        content,
      };
    } catch (error) {
      return handleError(error, 'Error getting skill reference');
    }
  },
});

export const WORKSPACE_SEARCH_SKILLS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workspace/skills/search',
  responseType: 'json',
  queryParamSchema: searchSkillsQuerySchema,
  responseSchema: searchSkillsResponseSchema,
  summary: 'Search skills',
  description: 'Searches across all skills content using BM25 keyword search',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, query, topK, minScore, skillNames, includeReferences }) => {
    try {
      if (!query) {
        throw new HTTPException(400, { message: 'Search query is required' });
      }

      const skills = getSkills(mastra);
      if (!skills) {
        return {
          results: [],
          query,
        };
      }

      // Parse comma-separated skill names if provided
      const skillNamesList = skillNames ? skillNames.split(',').map((s: string) => s.trim()) : undefined;

      const results = await skills.search(query, {
        topK: topK || 5,
        minScore,
        skillNames: skillNamesList,
        includeReferences: includeReferences ?? true,
      });

      return {
        results: results.map(r => ({
          skillName: r.skillName,
          source: r.source,
          content: r.content,
          score: r.score,
          lineRange: r.lineRange,
          scoreDetails: r.scoreDetails,
        })),
        query,
      };
    } catch (error) {
      return handleError(error, 'Error searching skills');
    }
  },
});

// Export all skills routes
// IMPORTANT: Search route must come before the parameterized routes
// to avoid /api/workspace/skills/search being matched as /api/workspace/skills/:skillName
export const WORKSPACE_SKILLS_ROUTES = [
  WORKSPACE_SEARCH_SKILLS_ROUTE,
  WORKSPACE_LIST_SKILLS_ROUTE,
  WORKSPACE_GET_SKILL_ROUTE,
  WORKSPACE_LIST_SKILL_REFERENCES_ROUTE,
  WORKSPACE_GET_SKILL_REFERENCE_ROUTE,
];
