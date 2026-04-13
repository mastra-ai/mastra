import { LocalSkillSource } from '@mastra/core/workspace';

import { HTTPException } from '../http-exception';
import {
  storedSkillIdPathParams,
  listStoredSkillsQuerySchema,
  createStoredSkillBodySchema,
  updateStoredSkillBodySchema,
  publishStoredSkillBodySchema,
  listStoredSkillsResponseSchema,
  getStoredSkillResponseSchema,
  createStoredSkillResponseSchema,
  updateStoredSkillResponseSchema,
  deleteStoredSkillResponseSchema,
  publishStoredSkillResponseSchema,
} from '../schemas/stored-skills';
import { createRoute } from '../server-adapter/routes/route-builder';
import { toSlug } from '../utils';

import { handleError } from './error';

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /stored/skills - List all stored skills
 */
export const LIST_STORED_SKILLS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/skills',
  responseType: 'json',
  queryParamSchema: listStoredSkillsQuerySchema,
  responseSchema: listStoredSkillsResponseSchema,
  summary: 'List stored skills',
  description: 'Returns a paginated list of all skill configurations stored in the database',
  tags: ['Stored Skills'],
  requiresAuth: true,
  handler: async ({ mastra, page, perPage, orderBy, authorId, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const skillStore = await storage.getStore('skills');
      if (!skillStore) {
        throw new HTTPException(500, { message: 'Skills storage domain is not available' });
      }

      const result = await skillStore.listResolved({
        page,
        perPage,
        orderBy,
        authorId,
        metadata,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing stored skills');
    }
  },
});

/**
 * GET /stored/skills/:storedSkillId - Get a stored skill by ID
 */
export const GET_STORED_SKILL_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/skills/:storedSkillId',
  responseType: 'json',
  pathParamSchema: storedSkillIdPathParams,
  responseSchema: getStoredSkillResponseSchema,
  summary: 'Get stored skill by ID',
  description: 'Returns a specific skill from storage by its unique identifier (resolved with active version config)',
  tags: ['Stored Skills'],
  requiresAuth: true,
  handler: async ({ mastra, storedSkillId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const skillStore = await storage.getStore('skills');
      if (!skillStore) {
        throw new HTTPException(500, { message: 'Skills storage domain is not available' });
      }

      const skill = await skillStore.getByIdResolved(storedSkillId);

      if (!skill) {
        throw new HTTPException(404, { message: `Stored skill with id ${storedSkillId} not found` });
      }

      return skill;
    } catch (error) {
      return handleError(error, 'Error getting stored skill');
    }
  },
});

/**
 * POST /stored/skills - Create a new stored skill
 */
export const CREATE_STORED_SKILL_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/skills',
  responseType: 'json',
  bodySchema: createStoredSkillBodySchema,
  responseSchema: createStoredSkillResponseSchema,
  summary: 'Create stored skill',
  description: 'Creates a new skill configuration in storage with the provided details',
  tags: ['Stored Skills'],
  requiresAuth: true,
  handler: async ({
    mastra,
    id: providedId,
    authorId,
    name,
    description,
    instructions,
    license,
    compatibility,
    source,
    references,
    scripts,
    assets,
    metadata,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const skillStore = await storage.getStore('skills');
      if (!skillStore) {
        throw new HTTPException(500, { message: 'Skills storage domain is not available' });
      }

      // Derive ID from name if not explicitly provided
      const id = providedId || toSlug(name);

      if (!id) {
        throw new HTTPException(400, {
          message: 'Could not derive skill ID from name. Please provide an explicit id.',
        });
      }

      // Check if skill with this ID already exists
      const existing = await skillStore.getById(id);
      if (existing) {
        throw new HTTPException(409, { message: `Skill with id ${id} already exists` });
      }

      await skillStore.create({
        skill: {
          id,
          authorId,
          name,
          description,
          instructions,
          license,
          compatibility,
          source,
          references,
          scripts,
          assets,
          metadata,
        },
      });

      // Return the resolved skill (thin record + version config)
      const resolved = await skillStore.getByIdResolved(id);
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve created skill' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error creating stored skill');
    }
  },
});

/**
 * PATCH /stored/skills/:storedSkillId - Update a stored skill
 */
export const UPDATE_STORED_SKILL_ROUTE = createRoute({
  method: 'PATCH',
  path: '/stored/skills/:storedSkillId',
  responseType: 'json',
  pathParamSchema: storedSkillIdPathParams,
  bodySchema: updateStoredSkillBodySchema,
  responseSchema: updateStoredSkillResponseSchema,
  summary: 'Update stored skill',
  description: 'Updates an existing skill in storage with the provided fields',
  tags: ['Stored Skills'],
  requiresAuth: true,
  handler: async ({
    mastra,
    storedSkillId,
    // Entity-level fields
    authorId,
    // Config fields (snapshot-level)
    name,
    description,
    instructions,
    license,
    compatibility,
    source,
    references,
    scripts,
    assets,
    metadata,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const skillStore = await storage.getStore('skills');
      if (!skillStore) {
        throw new HTTPException(500, { message: 'Skills storage domain is not available' });
      }

      // Check if skill exists
      const existing = await skillStore.getById(storedSkillId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored skill with id ${storedSkillId} not found` });
      }

      // Update the skill with both entity-level and config-level fields
      // The storage layer handles separating these into record updates vs new-version creation
      await skillStore.update({
        id: storedSkillId,
        authorId,
        name,
        description,
        instructions,
        license,
        compatibility,
        source,
        references,
        scripts,
        assets,
        metadata,
      });

      // Return the resolved skill with the updated config
      const resolved = await skillStore.getByIdResolved(storedSkillId);
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve updated skill' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error updating stored skill');
    }
  },
});

/**
 * DELETE /stored/skills/:storedSkillId - Delete a stored skill
 */
export const DELETE_STORED_SKILL_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/skills/:storedSkillId',
  responseType: 'json',
  pathParamSchema: storedSkillIdPathParams,
  responseSchema: deleteStoredSkillResponseSchema,
  summary: 'Delete stored skill',
  description: 'Deletes a skill from storage by its unique identifier',
  tags: ['Stored Skills'],
  requiresAuth: true,
  handler: async ({ mastra, storedSkillId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const skillStore = await storage.getStore('skills');
      if (!skillStore) {
        throw new HTTPException(500, { message: 'Skills storage domain is not available' });
      }

      // Check if skill exists
      const existing = await skillStore.getById(storedSkillId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored skill with id ${storedSkillId} not found` });
      }

      await skillStore.delete(storedSkillId);

      return {
        success: true,
        message: `Skill ${storedSkillId} deleted successfully`,
      };
    } catch (error) {
      return handleError(error, 'Error deleting stored skill');
    }
  },
});

/**
 * POST /stored/skills/:storedSkillId/publish - Publish a skill from filesystem
 * Walks the skill directory, hashes files into blob store, creates a new version
 * with the tree manifest, and sets activeVersionId.
 */
export const PUBLISH_STORED_SKILL_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/skills/:storedSkillId/publish',
  responseType: 'json',
  pathParamSchema: storedSkillIdPathParams,
  bodySchema: publishStoredSkillBodySchema,
  responseSchema: publishStoredSkillResponseSchema,
  summary: 'Publish stored skill',
  description:
    'Snapshots the skill directory from the filesystem into content-addressable blob storage, creates a new version with a tree manifest, and marks the skill as published',
  tags: ['Stored Skills'],
  requiresAuth: true,
  handler: async ({ mastra, storedSkillId, skillPath }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const skillStore = await storage.getStore('skills');
      if (!skillStore) {
        throw new HTTPException(500, { message: 'Skills storage domain is not available' });
      }

      const blobStore = await storage.getStore('blobs');
      if (!blobStore) {
        throw new HTTPException(500, { message: 'Blob storage domain is not available' });
      }

      // Verify skill exists
      const existing = await skillStore.getById(storedSkillId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored skill with id ${storedSkillId} not found` });
      }

      // Validate skillPath to prevent path traversal
      const path = await import('node:path');
      const resolvedPath = path.default.resolve(skillPath);
      const allowedBase = path.default.resolve(process.env.SKILLS_BASE_DIR || process.cwd());
      if (!resolvedPath.startsWith(allowedBase + path.default.sep) && resolvedPath !== allowedBase) {
        throw new HTTPException(400, {
          message: `skillPath must be within the allowed directory: ${allowedBase}`,
        });
      }

      // Use LocalSkillSource to read from the server filesystem
      const source = new LocalSkillSource();
      const { publishSkillFromSource } = await import('@mastra/core/workspace');

      const { snapshot, tree } = await publishSkillFromSource(source, resolvedPath, blobStore);

      // Update the skill with new version data + tree
      await skillStore.update({
        id: storedSkillId,
        ...snapshot,
        tree,
        status: 'published',
      });

      // Point activeVersionId to the newly created version
      const latestVersion = await skillStore.getLatestVersion(storedSkillId);
      if (latestVersion) {
        await skillStore.update({
          id: storedSkillId,
          activeVersionId: latestVersion.id,
        });
      }

      const resolved = await skillStore.getByIdResolved(storedSkillId);
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve skill after publish' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error publishing stored skill');
    }
  },
});
