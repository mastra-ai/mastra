import type { CoreTool } from '@mastra/core';
import type { MemoryConfig } from '@mastra/core/memory';
import { z } from 'zod';

/**
 * Tool for creating new episodes from conversation context
 */
export const createEpisodeTool = (config?: MemoryConfig): CoreTool => {
  return {
    description: `Create a new memory episode to remember important information from this conversation.

Category Guidelines:
- Life Events: "life-event", "milestone", "achievement"
- Personal: "family", "relationship", "personal"
- Professional: "work", "career", "education"
- Health: "health", "medical", "fitness", "important"
- Interests: "hobbies", "preferences", "goals"
- Other: "travel", "financial", "story"

Significance Scoring:
- 1.0: Critical information (allergies, medical conditions)
- 0.8-0.9: Major life events (job changes, moves)
- 0.6-0.7: Important preferences or recurring activities
- 0.4-0.5: Notable but less critical information
- 0.2-0.3: Minor details worth remembering

Create episodes when users share significant life events, stories, preferences, or important facts.`,
    parameters: z.object({
      title: z.string().describe('A concise, descriptive title for this episode'),
      shortSummary: z
        .string()
        .describe('A brief 1-2 sentence summary of the episode that will be shown in episode lists'),
      detailedSummary: z
        .string()
        .describe('A detailed summary of the episode including key facts, context, and relevant details'),
      categories: z
        .array(z.string())
        .describe(
          'Categories to organize this episode. Use consistent categories like: life-event, family, work, health, travel, preference, story, hobby, relationship, achievement, milestone, medical, fitness, career, education, financial',
        ),
      causalContext: z.string().optional().describe('Why this happened or what led to this event/situation'),
      spatialContext: z.string().optional().describe('Where this occurred - location, place, or environment'),
      relatedEpisodeIds: z.array(z.string()).optional().describe('IDs of other episodes that relate to this one'),
      sequenceId: z.string().optional().describe('ID to group episodes that are part of the same sequence or story'),
      significance: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('How significant/important this episode is. Use: 1.0 for critical info (allergies), 0.8-0.9 for major life events, 0.6-0.7 for important preferences, 0.4-0.5 for notable info, 0.2-0.3 for minor details'),
      messageIds: z
        .array(z.string())
        .optional()
        .describe('IDs of specific messages to link to this episode. If not provided, recent messages will be used'),
    }),
    execute: async (params: any) => {
      const { context, memory, threadId, resourceId } = params;
      const {
        title,
        shortSummary,
        detailedSummary,
        categories,
        causalContext,
        spatialContext,
        relatedEpisodeIds,
        sequenceId,
        significance,
        messageIds,
      } = context;
      if (!memory) {
        throw new Error('Memory is required to create episodes');
      }
      if (!threadId || !resourceId) {
        throw new Error('Thread ID and Resource ID are required to create episodes');
      }

      await memory.createEpisode({
        resourceId,
        threadId,
        title,
        shortSummary,
        detailedSummary,
        categories,
        causalContext,
        spatialContext,
        relatedEpisodeIds,
        sequenceId,
        significance,
        messageIds,
      });

      return {
        success: true,
        message: `Episode "${title}" created successfully`,
      };
    },
  };
};

/**
 * Tool for retrieving detailed information about a specific episode
 */
export const getEpisodeTool = (config?: MemoryConfig): CoreTool => {
  return {
    description: 'Retrieve detailed information about a specific memory episode',
    parameters: z.object({
      episodeId: z.string().describe('The ID of the episode to retrieve'),
    }),
    execute: async (params: any) => {
      const { context, memory } = params;
      const { episodeId } = context;
      if (!memory) {
        throw new Error('Memory is required to retrieve episodes');
      }

      const episode = await memory.getEpisode({ id: episodeId });

      if (!episode) {
        return {
          error: 'Episode not found',
        };
      }

      return {
        episode: {
          id: episode.id,
          title: episode.title,
          shortSummary: episode.shortSummary,
          detailedSummary: episode.detailedSummary,
          categories: episode.categories,
          causalContext: episode.causalContext,
          spatialContext: episode.spatialContext,
          relatedEpisodeIds: episode.relatedEpisodeIds,
          sequenceId: episode.sequenceId,
          significance: episode.significance,
          messageIds: episode.messageIds,
          createdAt: episode.createdAt,
          updatedAt: episode.updatedAt,
          metadata: episode.metadata,
        },
      };
    },
  };
};

/**
 * Tool for listing episodes with optional category filtering
 */
export const listEpisodesTool = (config?: MemoryConfig): CoreTool => {
  return {
    description: 'List memory episodes for the current user, optionally filtered by category',
    parameters: z.object({
      category: z.string().optional().describe('Filter episodes by category (e.g., "family", "work", "travel")'),
      limit: z.number().optional().default(10).describe('Maximum number of episodes to return'),
    }),
    execute: async (params: any) => {
      const { context, memory, resourceId } = params;
      const { category, limit } = context;
      if (!memory) {
        throw new Error('Memory is required to list episodes');
      }
      if (!resourceId) {
        throw new Error('Resource ID is required to list episodes');
      }

      const episodes = await memory.listEpisodes({
        resourceId,
        category,
        limit,
      });

      return {
        episodes: episodes.map((ep: any) => ({
          id: ep.id,
          title: ep.title,
          shortSummary: ep.shortSummary,
          categories: ep.categories,
          createdAt: ep.createdAt,
        })),
        total: episodes.length,
      };
    },
  };
};

/**
 * Tool for updating existing episodes
 */
export const updateEpisodeTool = (config?: MemoryConfig): CoreTool => {
  return {
    description: 'Update an existing memory episode with new information',
    parameters: z.object({
      episodeId: z.string().describe('The ID of the episode to update'),
      title: z.string().optional().describe('New title for the episode'),
      shortSummary: z.string().optional().describe('New short summary'),
      detailedSummary: z.string().optional().describe('New detailed summary'),
      categories: z.array(z.string()).optional().describe('New categories'),
      causalContext: z.string().optional().describe('New causal context - why this happened'),
      spatialContext: z.string().optional().describe('New spatial context - where this occurred'),
      relatedEpisodeIds: z.array(z.string()).optional().describe('New related episode IDs'),
      sequenceId: z.string().optional().describe('New sequence ID'),
      significance: z.number().min(0).max(1).optional().describe('New significance score (0-1)'),
      messageIds: z.array(z.string()).optional().describe('New message IDs to link'),
    }),
    execute: async (params: any) => {
      const { context, memory } = params;
      const { episodeId, ...updates } = context;
      if (!memory) {
        throw new Error('Memory is required to update episodes');
      }

      await memory.updateEpisode({
        id: episodeId,
        updates,
      });

      return {
        success: true,
        message: `Episode "${episodeId}" updated successfully`,
      };
    },
  };
};

/**
 * Tool for getting available episode categories
 */
export const getEpisodeCategoresTool = (config?: MemoryConfig): CoreTool => {
  return {
    description: 'Get the list of available episode categories for the current user',
    parameters: z.object({}),
    execute: async (params: any) => {
      const { memory, resourceId } = params;
      if (!memory) {
        throw new Error('Memory is required to get categories');
      }
      if (!resourceId) {
        throw new Error('Resource ID is required to get categories');
      }

      const categories = await memory.getEpisodeCategories({ resourceId });

      return {
        categories,
        suggestedCategories: [
          'life-event',
          'family',
          'work',
          'health',
          'travel',
          'preference',
          'story',
          'hobby',
          'relationship',
          'achievement',
        ],
      };
    },
  };
};

/**
 * Tool for linking episodes together
 */
export const linkEpisodesTool = (config?: MemoryConfig): CoreTool => {
  return {
    description: `Link two memory episodes together with a relationship.

Relationship Types:
- "caused-by": One event led to another (e.g., "moved to SF" caused-by "got job at TechCorp")
- "leads-to": Expected future consequence (e.g., "started training" leads-to "run marathon")
- "part-of": Component of a larger event (e.g., "visited Louvre" part-of "Paris vacation")
- "similar-to": Related but distinct events (e.g., two different promotions)
- "related-to": General relationship (default for other connections)

Use relationships to build a knowledge graph of the user's experiences and connect cause-effect chains.`,
    parameters: z.object({
      episodeId1: z.string().describe('The ID of the first episode'),
      episodeId2: z.string().describe('The ID of the second episode'),
      relationshipType: z
        .enum(['caused-by', 'leads-to', 'part-of', 'similar-to', 'related-to'])
        .optional()
        .default('related-to')
        .describe('The type of relationship between the episodes'),
    }),
    execute: async (params: any) => {
      const { context, memory } = params;
      const { episodeId1, episodeId2, relationshipType } = context;
      if (!memory) {
        throw new Error('Memory is required to link episodes');
      }

      await memory.linkEpisodes({
        episodeId1,
        episodeId2,
        relationshipType,
      });

      return {
        success: true,
        message: `Episodes linked successfully with relationship: ${relationshipType}`,
      };
    },
  };
};

/**
 * Tool for getting related episodes
 */
export const getRelatedEpisodesTool = (config?: MemoryConfig): CoreTool => {
  return {
    description: 'Get all episodes related to a specific episode',
    parameters: z.object({
      episodeId: z.string().describe('The ID of the episode to find relations for'),
      includeIndirect: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include episodes that are indirectly related (related to related episodes)'),
    }),
    execute: async (params: any) => {
      const { context, memory } = params;
      const { episodeId, includeIndirect } = context;
      if (!memory) {
        throw new Error('Memory is required to get related episodes');
      }

      const relatedEpisodes = await memory.getRelatedEpisodes({
        episodeId,
        includeIndirect,
      });

      return {
        episodes: relatedEpisodes.map((ep: any) => ({
          id: ep.id,
          title: ep.title,
          shortSummary: ep.shortSummary,
          categories: ep.categories,
          relationshipType: ep.metadata?.relationships?.[episodeId]?.type || 'related-to',
        })),
        total: relatedEpisodes.length,
      };
    },
  };
};
