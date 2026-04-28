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

import {
  assertReadAccess,
  assertWriteAccess,
  getCallerAuthorId,
  matchesAuthorFilter,
  resolveAuthorFilter,
} from './authorship';
import { isBuilderFeatureEnabled } from './editor-builder';
import { handleError } from './error';
import { prepareStarsEnrichment, stripStarFields } from './stars-enrichment';

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
  handler: async ({
    mastra,
    requestContext,
    page,
    perPage,
    orderBy,
    status,
    authorId,
    visibility,
    metadata,
    starredOnly,
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

      const filter = resolveAuthorFilter({
        requestContext,
        resource: 'skills',
        queryAuthorId: authorId,
        queryVisibility: visibility,
      });

      const callerId = getCallerAuthorId(requestContext);
      const starsEnabled = await isBuilderFeatureEnabled(mastra, 'stars');
      const honoredStarredOnly = starsEnabled && starredOnly === true;

      // `?starredOnly=true` flow: fetch caller's starred IDs, restrict the list
      // to that set, then post-filter by visibility and recompute total/pages.
      if (honoredStarredOnly) {
        const effectivePerPage: number = perPage ?? 100;
        if (!callerId) {
          // Caller cannot have starred anything without an identity.
          return { skills: [], total: 0, page, perPage: effectivePerPage, hasMore: false };
        }
        const starsStore = await storage.getStore('stars');
        if (!starsStore) {
          throw new HTTPException(500, { message: 'Stars storage domain is not available' });
        }
        const starredIds = await starsStore.listStarredIds({ userId: callerId, entityType: 'skill' });
        if (starredIds.length === 0) {
          return { skills: [], total: 0, page, perPage: effectivePerPage, hasMore: false };
        }
        const allMatching = await skillStore.listResolved({
          perPage: false,
          orderBy,
          status,
          authorId: filter.kind === 'exact' ? filter.authorId : undefined,
          metadata,
          entityIds: starredIds,
        });
        const visible = allMatching.skills.filter(record => matchesAuthorFilter(record, filter));
        const total = visible.length;
        const startIdx = effectivePerPage === 0 ? 0 : page * effectivePerPage;
        const endIdx = effectivePerPage === 0 ? 0 : startIdx + effectivePerPage;
        const sliced = effectivePerPage === 0 ? [] : visible.slice(startIdx, endIdx);
        const annotated = sliced.map(record => ({ ...record, isStarred: true }));
        const hasMore = effectivePerPage > 0 && endIdx < total;
        return {
          skills: annotated,
          total,
          page,
          perPage: effectivePerPage,
          hasMore,
        };
      }

      const result = await skillStore.listResolved({
        page,
        perPage,
        orderBy,
        status,
        authorId: filter.kind === 'exact' ? filter.authorId : undefined,
        metadata,
      });

      const visibleSkills = result.skills.filter(record => matchesAuthorFilter(record, filter));

      if (!starsEnabled) {
        return { ...result, skills: visibleSkills.map(stripStarFields) };
      }

      const enrichment = await prepareStarsEnrichment(
        mastra,
        requestContext,
        'skill',
        visibleSkills.map(s => s.id),
      );
      const annotated = enrichment
        ? visibleSkills.map(record => ({ ...record, isStarred: enrichment.starredIds.has(record.id) }))
        : visibleSkills;

      return { ...result, skills: annotated };
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
  handler: async ({ mastra, requestContext, storedSkillId }) => {
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

      assertReadAccess({ requestContext, resource: 'skills', resourceId: storedSkillId, record: skill });

      const enrichment = await prepareStarsEnrichment(mastra, requestContext, 'skill', [skill.id]);
      if (enrichment) {
        return { ...skill, isStarred: enrichment.starredIds.has(skill.id) };
      }
      return stripStarFields(skill);
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
    requestContext,
    id: providedId,
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
    visibility: bodyVisibility,
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

      // Force authorId from the authenticated caller; ignore any body-provided value.
      // Default visibility: 'private' when there's an owner, 'public' when unowned
      // (no auth / no user context). Unowned resources should always be public.
      const authorId = getCallerAuthorId(requestContext) ?? undefined;
      const visibility: 'private' | 'public' = bodyVisibility ?? (authorId ? 'private' : 'public');

      await skillStore.create({
        skill: {
          id,
          authorId,
          visibility,
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
    requestContext,
    storedSkillId,
    // Entity-level fields
    authorId,
    visibility,
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

      // Throws 404 if the caller isn't the owner, admin, or `skills:edit[:<id>]` holder.
      assertWriteAccess({
        requestContext,
        resource: 'skills',
        resourceId: storedSkillId,
        action: 'edit',
        record: existing,
      });

      // Update the skill with both entity-level and config-level fields
      // The storage layer handles separating these into record updates vs new-version creation
      await skillStore.update({
        id: storedSkillId,
        authorId,
        visibility,
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
  handler: async ({ mastra, requestContext, storedSkillId }) => {
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

      // Throws 404 if the caller isn't the owner, admin, or `skills:delete[:<id>]` holder.
      assertWriteAccess({
        requestContext,
        resource: 'skills',
        resourceId: storedSkillId,
        action: 'delete',
        record: existing,
      });

      await skillStore.delete(storedSkillId);

      // Cascade: drop any star rows referencing this skill. Failure must not
      // abort the delete.
      try {
        const starsStore = await storage.getStore('stars');
        await starsStore?.deleteStarsForEntity({ entityType: 'skill', entityId: storedSkillId });
      } catch (cascadeError) {
        mastra
          .getLogger?.()
          ?.warn?.('Failed to cascade-delete stars for skill', { storedSkillId, error: cascadeError });
      }

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
  handler: async ({ mastra, requestContext, storedSkillId, skillPath }) => {
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

      // Throws 404 if the caller isn't the owner, admin, or `skills:edit[:<id>]` holder.
      assertWriteAccess({
        requestContext,
        resource: 'skills',
        resourceId: storedSkillId,
        action: 'edit',
        record: existing,
      });

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
