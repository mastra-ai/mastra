import type { MastraSkills } from '@mastra/core/skills';
import { HTTPException } from '../http-exception';
import { agentSkillPathParams } from '../schemas/agents';
import {
  skillNamePathParams,
  skillReferencePathParams,
  searchSkillsQuerySchema,
  listSkillsResponseSchema,
  getSkillResponseSchema,
  getAgentSkillResponseSchema,
  skillReferenceResponseSchema,
  listReferencesResponseSchema,
  searchSkillsResponseSchema,
} from '../schemas/skills';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

/**
 * Get the skills instance from Mastra.
 * Returns null if no skills instance is registered.
 */
function getSkills(mastra: any): MastraSkills | null {
  return mastra.getSkills?.() ?? null;
}

// ============================================================================
// Route Definitions
// ============================================================================

export const LIST_SKILLS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/skills',
  responseType: 'json',
  responseSchema: listSkillsResponseSchema,
  summary: 'List all skills',
  description: 'Returns a list of all discovered skills with their metadata',
  tags: ['Skills'],
  handler: async ({ mastra }) => {
    try {
      const skills = getSkills(mastra);
      if (!skills) {
        return { skills: [], isSkillsConfigured: false };
      }

      const skillsList = skills.list();

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

export const GET_SKILL_ROUTE = createRoute({
  method: 'GET',
  path: '/api/skills/:skillName',
  responseType: 'json',
  pathParamSchema: skillNamePathParams,
  responseSchema: getSkillResponseSchema,
  summary: 'Get skill details',
  description: 'Returns the full details of a specific skill including instructions and file lists',
  tags: ['Skills'],
  handler: async ({ mastra, skillName }) => {
    try {
      if (!skillName) {
        throw new HTTPException(400, { message: 'Skill name is required' });
      }

      const skills = getSkills(mastra);
      if (!skills) {
        throw new HTTPException(404, { message: 'No Skills instance registered with Mastra' });
      }

      const skill = skills.get(skillName);
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

export const LIST_SKILL_REFERENCES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/skills/:skillName/references',
  responseType: 'json',
  pathParamSchema: skillNamePathParams,
  responseSchema: listReferencesResponseSchema,
  summary: 'List skill references',
  description: 'Returns a list of all reference file paths for a skill',
  tags: ['Skills'],
  handler: async ({ mastra, skillName }) => {
    try {
      if (!skillName) {
        throw new HTTPException(400, { message: 'Skill name is required' });
      }

      const skills = getSkills(mastra);
      if (!skills) {
        throw new HTTPException(404, { message: 'No Skills instance registered with Mastra' });
      }

      if (!skills.has(skillName)) {
        throw new HTTPException(404, { message: `Skill "${skillName}" not found` });
      }

      const references = skills.getReferences(skillName);

      return {
        skillName,
        references,
      };
    } catch (error) {
      return handleError(error, 'Error listing skill references');
    }
  },
});

export const GET_SKILL_REFERENCE_ROUTE = createRoute({
  method: 'GET',
  path: '/api/skills/:skillName/references/:referencePath',
  responseType: 'json',
  pathParamSchema: skillReferencePathParams,
  responseSchema: skillReferenceResponseSchema,
  summary: 'Get skill reference content',
  description: 'Returns the content of a specific reference file from a skill',
  tags: ['Skills'],
  handler: async ({ mastra, skillName, referencePath }) => {
    try {
      if (!skillName || !referencePath) {
        throw new HTTPException(400, { message: 'Skill name and reference path are required' });
      }

      const skills = getSkills(mastra);
      if (!skills) {
        throw new HTTPException(404, { message: 'No Skills instance registered with Mastra' });
      }

      // Decode the reference path (it may be URL encoded)
      const decodedPath = decodeURIComponent(referencePath);

      const content = skills.getReference(skillName, decodedPath);
      if (content === undefined) {
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

export const SEARCH_SKILLS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/skills/search',
  responseType: 'json',
  queryParamSchema: searchSkillsQuerySchema,
  responseSchema: searchSkillsResponseSchema,
  summary: 'Search skills',
  description: 'Searches across all skills content using BM25 keyword search',
  tags: ['Skills'],
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
      const skillNamesList = skillNames ? skillNames.split(',').map(s => s.trim()) : undefined;

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

// ============================================================================
// Agent Skill Routes
// ============================================================================

export const GET_AGENT_SKILL_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agents/:agentId/skills/:skillName',
  responseType: 'json',
  pathParamSchema: agentSkillPathParams,
  responseSchema: getAgentSkillResponseSchema,
  summary: 'Get agent skill',
  description: 'Returns details for a specific skill available to the agent',
  tags: ['Agents', 'Skills'],
  handler: async ({ mastra, agentId, skillName }) => {
    try {
      const agent = agentId ? mastra.getAgentById(agentId) : null;
      if (!agent) {
        throw new HTTPException(404, { message: 'Agent not found' });
      }

      if (!skillName) {
        throw new HTTPException(400, { message: 'Skill name is required' });
      }

      // Get skills directly from agent (resolves agent-specific or inherited from Mastra)
      const skills = agent.getSkills();
      if (!skills) {
        throw new HTTPException(404, { message: 'No skills configured for this agent' });
      }

      const skill = skills.get(skillName);
      if (!skill) {
        throw new HTTPException(404, { message: `Skill "${skillName}" not found for this agent` });
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
      return handleError(error, 'Error getting agent skill');
    }
  },
});
