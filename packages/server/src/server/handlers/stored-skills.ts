import type { StorageSkillFileNode } from '@mastra/core/storage';
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
import { toSlug, assertStoredResourceScope, getStoredResourceScope, scopeStoredResourceMetadata } from '../utils';

import {
  assertReadAccess,
  assertWriteAccess,
  getCallerAuthorId,
  matchesAuthorFilter,
  resolveAuthorFilter,
} from './authorship';
import { isBuilderFeatureEnabled } from './editor-builder';
import { handleError } from './error';
import { enrichOrStripFavorites, prepareFavoritesEnrichment, stripFavoriteFields } from './favorites-enrichment';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Well-known folder names in the skill file tree whose children represent
 * indexable path arrays (references, scripts, assets).
 */
const INDEXED_FOLDERS = ['references', 'scripts', 'assets'] as const;

/**
 * Walks the `files` tree and collects relative file paths for each well-known
 * folder (references, scripts, assets).  Returned arrays only include entries
 * that are not already present in any explicitly-provided arrays so callers
 * can pass both `files` and `references` without creating duplicates.
 */
function extractIndexedPathsFromFiles(
  files: StorageSkillFileNode[] | undefined,
  existing: {
    references?: string[];
    scripts?: string[];
    assets?: string[];
  },
): {
  references?: string[];
  scripts?: string[];
  assets?: string[];
} {
  if (!files || files.length === 0) return {};

  // Find the root folder (first folder node, usually id="root")
  const root = files.find(n => n.type === 'folder');
  if (!root?.children) return {};

  const result: Record<string, string[]> = {};

  for (const folderName of INDEXED_FOLDERS) {
    const folder = root.children.find(n => n.type === 'folder' && n.name === folderName);
    if (!folder?.children || folder.children.length === 0) continue;

    const existingPaths = new Set(existing[folderName] ?? []);
    const paths: string[] = [...existingPaths];

    collectFilePaths(folder.children, folderName, existingPaths, paths);

    if (paths.length > 0) {
      result[folderName] = paths;
    }
  }

  return result;
}

/** Recursively collects file paths from a subtree, building relative paths. */
function collectFilePaths(
  nodes: StorageSkillFileNode[],
  prefix: string,
  existingPaths: Set<string>,
  out: string[],
): void {
  for (const node of nodes) {
    if (node.type === 'file') {
      const relativePath = `${prefix}/${node.name}`;
      if (!existingPaths.has(relativePath)) {
        out.push(relativePath);
      }
    } else if (node.type === 'folder' && node.children) {
      collectFilePaths(node.children, `${prefix}/${node.name}`, existingPaths, out);
    }
  }
}

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
    favoritedOnly,
    pinFavoritedFor,
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
        resource: 'stored-skills',
        queryAuthorId: authorId,
        queryVisibility: visibility,
      });

      const scope = await getStoredResourceScope(mastra, requestContext);
      const scopedMetadata = scopeStoredResourceMetadata(metadata, scope);

      const callerId = getCallerAuthorId(requestContext);
      const favoritesEnabled = await isBuilderFeatureEnabled(mastra, 'favorites');
      const honoredStarredOnly = favoritesEnabled && favoritedOnly === true;
      const favoriteSubjectId = pinFavoritedFor ?? callerId;

      // `?favoritedOnly=true` flow: fetch caller's favorited IDs, restrict the list
      // to that set, then post-filter by visibility and recompute total/pages.
      if (honoredStarredOnly) {
        const effectivePerPage: number = perPage ?? 100;
        if (!favoriteSubjectId) {
          // Caller cannot have favorited anything without an identity.
          return { skills: [], total: 0, page, perPage: effectivePerPage, hasMore: false };
        }
        const favoritesStore = await storage.getStore('favorites');
        if (!favoritesStore) {
          throw new HTTPException(500, { message: 'Favorites storage domain is not available' });
        }
        const starredIds = await favoritesStore.listFavoritedIds({ userId: favoriteSubjectId, entityType: 'skill' });
        if (starredIds.length === 0) {
          return { skills: [], total: 0, page, perPage: effectivePerPage, hasMore: false };
        }
        const allMatching = await skillStore.listResolved({
          perPage: false,
          orderBy,
          status,
          authorId: filter.kind === 'exact' ? filter.authorId : undefined,
          metadata: scopedMetadata,
          entityIds: starredIds,
        });
        const visible = allMatching.skills.filter(record => matchesAuthorFilter(record, filter));
        const total = visible.length;
        const startIdx = effectivePerPage === 0 ? 0 : page * effectivePerPage;
        const endIdx = effectivePerPage === 0 ? 0 : startIdx + effectivePerPage;
        const sliced = effectivePerPage === 0 ? [] : visible.slice(startIdx, endIdx);
        const annotated = sliced.map(record => ({ ...record, isFavorited: true }));
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
        metadata: scopedMetadata,
      });

      // Post-filter to enforce ownership + visibility rules across all backends.
      // Storage adapters can only do an equality filter on authorId, so we apply
      // the ownedOrPublic / publicOnly logic here.
      // Note: `result.total` / `result.hasMore` reflect the storage-reported
      // count before this post-filter. For `unrestricted` / `exact` filters
      // nothing is removed; for `ownedOrPublic` / `publicOnly`, downstream UIs
      // should treat the filter as a view over the caller's scope — an
      // approximation is OK and preserves pagination math.
      const visibleSkills = result.skills.filter(record => matchesAuthorFilter(record, filter));

      if (!favoritesEnabled) {
        return { ...result, skills: visibleSkills.map(stripFavoriteFields) };
      }

      const enrichment = await prepareFavoritesEnrichment(
        mastra,
        requestContext,
        'skill',
        visibleSkills.map(s => s.id),
      );
      const annotated = enrichment
        ? visibleSkills.map(record => ({ ...record, isFavorited: enrichment.starredIds.has(record.id) }))
        : visibleSkills.map(stripFavoriteFields);

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
      assertStoredResourceScope(skill, await getStoredResourceScope(mastra, requestContext));

      assertReadAccess({ requestContext, resource: 'stored-skills', resourceId: storedSkillId, record: skill });

      return enrichOrStripFavorites(mastra, requestContext, 'skill', skill);
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
    files,
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
      // No owner = always public (no auth / no user context).
      // With an owner, respect the client's choice, defaulting to 'private'.
      const authorId = getCallerAuthorId(requestContext) ?? undefined;
      const visibility: 'private' | 'public' = authorId ? (bodyVisibility ?? 'private') : 'public';

      // Derive references/scripts/assets path arrays from the files tree
      // so agents can discover them via skill_read even when only `files` is provided.
      const indexedPaths = extractIndexedPathsFromFiles(files, { references, scripts, assets });

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
          references: indexedPaths.references ?? references,
          scripts: indexedPaths.scripts ?? scripts,
          assets: indexedPaths.assets ?? assets,
          files,
          metadata: scopeStoredResourceMetadata(metadata, await getStoredResourceScope(mastra, requestContext)),
        },
      });

      // Return the resolved skill (thin record + version config)
      const resolved = await skillStore.getByIdResolved(id);
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve created skill' });
      }

      return enrichOrStripFavorites(mastra, requestContext, 'skill', resolved);
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
    files,
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

      // Check if skill exists. Skill metadata lives on the resolved snapshot.
      const existing = await skillStore.getByIdResolved(storedSkillId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored skill with id ${storedSkillId} not found` });
      }
      const scope = await getStoredResourceScope(mastra, requestContext);
      assertStoredResourceScope(existing, scope);

      // Throws 404 if the caller isn't the owner, admin, or `stored-skills:write[:<id>]` holder.
      assertWriteAccess({
        requestContext,
        resource: 'stored-skills',
        resourceId: storedSkillId,
        action: 'edit',
        record: existing,
      });

      // No owner = always public, regardless of what the client sent.
      const callerAuthorId = getCallerAuthorId(requestContext) ?? undefined;
      const resolvedVisibility = callerAuthorId ? visibility : visibility != null ? 'public' : undefined;

      // Derive references/scripts/assets path arrays from the files tree
      const indexedPaths = files ? extractIndexedPathsFromFiles(files, { references, scripts, assets }) : {};

      // Update the skill with both entity-level and config-level fields.
      // The storage layer handles separating these into record updates vs
      // new-version creation, but it uses `field in updates` to detect config
      // changes — so we must only include fields the caller actually sent.
      // Forwarding `undefined` keys would trigger a spurious version create
      // and pass `undefined` into the database driver.
      const update: Record<string, unknown> = { id: storedSkillId };
      if (authorId !== undefined) update.authorId = authorId;
      if (resolvedVisibility !== undefined) update.visibility = resolvedVisibility;
      if (name !== undefined) update.name = name;
      if (description !== undefined) update.description = description;
      if (instructions !== undefined) update.instructions = instructions;
      if (license !== undefined) update.license = license;
      if (compatibility !== undefined) update.compatibility = compatibility;
      if (source !== undefined) update.source = source;
      const resolvedReferences = indexedPaths.references ?? references;
      const resolvedScripts = indexedPaths.scripts ?? scripts;
      const resolvedAssets = indexedPaths.assets ?? assets;
      if (resolvedReferences !== undefined) update.references = resolvedReferences;
      if (resolvedScripts !== undefined) update.scripts = resolvedScripts;
      if (resolvedAssets !== undefined) update.assets = resolvedAssets;
      if (files !== undefined) update.files = files;
      if (metadata !== undefined) {
        update.metadata = scopeStoredResourceMetadata({ ...(existing.metadata ?? {}), ...metadata }, scope);
      }

      await skillStore.update(update as Parameters<typeof skillStore.update>[0]);

      // Return the resolved skill with the updated config
      const resolved = await skillStore.getByIdResolved(storedSkillId);
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve updated skill' });
      }

      return enrichOrStripFavorites(mastra, requestContext, 'skill', resolved);
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

      // Check if skill exists. Skill metadata lives on the resolved snapshot.
      const existing = await skillStore.getByIdResolved(storedSkillId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored skill with id ${storedSkillId} not found` });
      }
      assertStoredResourceScope(existing, await getStoredResourceScope(mastra, requestContext));

      // Throws 404 if the caller isn't the owner, admin, or `skills:delete[:<id>]` holder.
      assertWriteAccess({
        requestContext,
        resource: 'stored-skills',
        resourceId: storedSkillId,
        action: 'delete',
        record: existing,
      });

      await skillStore.delete(storedSkillId);

      // Cascade: drop any favorite rows referencing this skill. Failure must not
      // abort the delete.
      try {
        const favoritesStore = await storage.getStore('favorites');
        await favoritesStore?.deleteFavoritesForEntity({ entityType: 'skill', entityId: storedSkillId });
      } catch (cascadeError) {
        mastra
          .getLogger?.()
          ?.warn?.('Failed to cascade-delete favorites for skill', { storedSkillId, error: cascadeError });
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

      // Verify skill exists. Skill metadata lives on the resolved snapshot.
      const existing = await skillStore.getByIdResolved(storedSkillId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored skill with id ${storedSkillId} not found` });
      }
      assertStoredResourceScope(existing, await getStoredResourceScope(mastra, requestContext));

      // Throws 404 if the caller isn't the owner, admin, or `stored-skills:write[:<id>]` holder.
      assertWriteAccess({
        requestContext,
        resource: 'stored-skills',
        resourceId: storedSkillId,
        action: 'edit',
        record: existing,
      });

      // Validate skillPath to prevent path traversal
      const path = await import('node:path');
      const fs = await import('node:fs/promises');
      const resolvedPath = path.default.resolve(skillPath);
      const allowedBase = path.default.resolve(process.env.SKILLS_BASE_DIR || process.cwd());
      if (!resolvedPath.startsWith(allowedBase + path.default.sep) && resolvedPath !== allowedBase) {
        throw new HTTPException(400, {
          message: `skillPath must be within the allowed directory: ${allowedBase}`,
        });
      }

      // Verify the source directory exists and contains a SKILL.md before attempting
      // to publish, so callers get a 400 with context instead of a raw 500/ENOENT.
      try {
        const stat = await fs.stat(resolvedPath);
        if (!stat.isDirectory()) {
          throw new HTTPException(400, { message: `skillPath is not a directory: ${resolvedPath}` });
        }
      } catch (err) {
        if (err instanceof HTTPException) throw err;
        if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
          throw new HTTPException(400, {
            message: `skillPath does not exist on the server filesystem: ${resolvedPath}. Create the skill directory (with a SKILL.md) before publishing, or use a skill that was materialized to disk.`,
          });
        }
        throw err;
      }
      try {
        await fs.stat(path.default.join(resolvedPath, 'SKILL.md'));
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
          throw new HTTPException(400, {
            message: `skillPath is missing SKILL.md: ${resolvedPath}`,
          });
        }
        throw err;
      }

      // Use LocalSkillSource to read from the server filesystem
      const source = new LocalSkillSource();
      const { publishSkillFromSource } = await import('@mastra/core/workspace');

      const { snapshot, tree, files } = await publishSkillFromSource(source, resolvedPath, blobStore);

      // Strip undefined keys from the snapshot before passing to update(). The
      // storage layer treats "field present" as "field changed"; forwarding
      // undefined would overwrite populated columns with undefined and trip
      // NOT NULL / "undefined cannot be passed as argument" errors in
      // adapters that bind args raw (libsql, pg).
      const snapshotUpdate: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(snapshot)) {
        if (value !== undefined) snapshotUpdate[key] = value;
      }

      // Update the skill with new version data + tree + UI-facing file tree.
      // `files` is the nested folder/file structure shown in the editor; without
      // it the column would stay null and the UI would render an empty tree.
      await skillStore.update({
        id: storedSkillId,
        ...snapshotUpdate,
        tree,
        files,
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

      return enrichOrStripFavorites(mastra, requestContext, 'skill', resolved);
    } catch (error) {
      return handleError(error, 'Error publishing stored skill');
    }
  },
});
