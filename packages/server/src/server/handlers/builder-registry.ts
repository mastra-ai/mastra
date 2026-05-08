/**
 * Builder Registry Handlers
 *
 * Routes that let admins browse and install skills from configured external
 * registries (currently just skills.sh) directly into the Builder's stored
 * skills DB. Distinct from the workspace skills.sh routes, which write to a
 * workspace filesystem and never touch storage.
 *
 * Registry availability is driven by `AgentBuilderOptions.registries`. When
 * the requested registry is disabled (or the builder is missing entirely),
 * the routes 404 instead of leaking the surface.
 */

import type { Mastra } from '@mastra/core';
import type { StorageSkillFileNode } from '@mastra/core/storage';

import { HTTPException } from '../http-exception';
import {
  builderRegistriesResponseSchema,
  builderRegistryInstallBodySchema,
  builderRegistryInstallResponseSchema,
  builderRegistryPathParams,
  builderRegistryPopularQuerySchema,
  builderRegistryPreviewQuerySchema,
  builderRegistrySearchQuerySchema,
} from '../schemas/builder-registry';
import {
  skillsShListResponseSchema,
  skillsShPreviewResponseSchema,
  skillsShSearchResponseSchema,
} from '../schemas/workspace';
import { createRoute } from '../server-adapter/routes/route-builder';
import { toSlug } from '../utils';
import { getCallerAuthorId } from './authorship';
import { handleError } from './error';
import {
  assertSafeFilePath,
  assertSafeSkillName,
  fetchSkillFiles,
  getPopularSkillsSh,
  previewSkillsSh,
  searchSkillsSh,
} from './skills-sh-shared';

// =============================================================================
// Registry resolution
// =============================================================================

/** Stable identifiers + display labels for every supported registry. */
const REGISTRY_LABELS: Record<string, string> = {
  'skills-sh': 'skills.sh',
};

interface RegistryStatus {
  id: 'skills-sh';
  enabled: boolean;
  label: string;
}

/**
 * Resolve which registries are enabled for the running deployment by reading
 * the builder's `registries` config. Returns a list with all known registries
 * (so the frontend can render an empty/disabled state) plus their enabled
 * flag.
 */
async function resolveRegistries(mastra: Mastra): Promise<RegistryStatus[]> {
  const editor = mastra.getEditor();
  if (!editor || typeof editor.resolveBuilder !== 'function') {
    return [{ id: 'skills-sh', enabled: false, label: REGISTRY_LABELS['skills-sh']! }];
  }
  const builder = await editor.resolveBuilder();
  const registries = builder?.getRegistries?.();
  return [
    {
      id: 'skills-sh',
      enabled: registries?.skillsSh?.enabled === true,
      label: REGISTRY_LABELS['skills-sh']!,
    },
  ];
}

/**
 * Hard-gate: throws 404 when the requested registry is unknown or disabled.
 * Mirrors `requireBuilderFeature` semantics — no surface leak for OFF registries.
 */
async function requireEnabledRegistry(mastra: Mastra, registryId: string): Promise<void> {
  const list = await resolveRegistries(mastra);
  const match = list.find(r => r.id === registryId);
  if (!match || !match.enabled) {
    throw new HTTPException(404, { message: 'Registry not found' });
  }
}

// =============================================================================
// File-tree helpers
// =============================================================================

/**
 * Convert a flat list of `{ path, content, encoding }` entries into the
 * `StorageSkillFileNode` tree shape expected by the stored-skills create path.
 *
 * Each path is validated via `assertSafeFilePath` to prevent traversal from
 * upstream-controlled responses. Folder nodes are created on demand.
 */
function buildFileTree(
  files: Array<{ path: string; content: string; encoding: 'utf-8' | 'base64' }>,
): StorageSkillFileNode[] {
  const root: StorageSkillFileNode[] = [];

  for (const file of files) {
    const safePath = assertSafeFilePath(file.path);
    const segments = safePath.split('/').filter(Boolean);
    if (segments.length === 0) continue;

    let cursor = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]!;
      let folder = cursor.find(node => node.type === 'folder' && node.name === segment);
      if (!folder) {
        folder = { name: segment, type: 'folder', children: [] };
        cursor.push(folder);
      }
      if (!folder.children) folder.children = [];
      cursor = folder.children;
    }

    const fileName = segments[segments.length - 1]!;
    const content = file.encoding === 'base64' ? Buffer.from(file.content, 'base64').toString('utf-8') : file.content;
    cursor.push({ name: fileName, type: 'file', content });
  }

  return root;
}

/**
 * Locally-bound SKILL.md frontmatter parser.
 *
 * Mirrors `parseSkillSnapshotFromFiles` from `@mastra/core/workspace`, but
 * inlined here because the server package's `@mastra/core` peer floor
 * (>=1.32.0) predates that helper. Once the floor is bumped to a release
 * containing the helper, this can be replaced by the shared core import.
 *
 * Only SKILL.md is consulted — frontmatter is split from the body using a
 * minimal YAML key:value reader sufficient for the fields registries
 * actually use (name, description). The body is everything after the
 * second `---` line, trimmed.
 */
type ParsedSkillSnapshot = {
  name?: string;
  description?: string;
  instructions: string;
};

function parseSkillSnapshot(
  files: Array<{ path: string; content: string; encoding: 'utf-8' | 'base64' }>,
): ParsedSkillSnapshot | null {
  const skillMd = files.find(f => f.path === 'SKILL.md');
  if (!skillMd) return null;

  const raw =
    skillMd.encoding === 'base64' ? Buffer.from(skillMd.content, 'base64').toString('utf-8') : skillMd.content;

  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { instructions: raw.trim() };
  }

  const fmBlock = fmMatch[1] ?? '';
  const body = fmMatch[2] ?? '';
  const frontmatter: Record<string, string> = {};
  for (const line of fmBlock.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2] ?? '';
    if (!key) continue;
    // Strip surrounding quotes, leave the rest as-is. Registry SKILL.md
    // frontmatter is consistently flat string fields in practice.
    frontmatter[key] = value.trim().replace(/^["'](.*)["']$/, '$1');
  }

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    instructions: body.trim(),
  };
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /editor/builder/registries
 *
 * Lists every known registry and whether it's enabled in this deployment.
 * Used by the Builder UI to decide whether to show the "Browse registry"
 * entry point at all.
 */
export const LIST_BUILDER_REGISTRIES_ROUTE = createRoute({
  method: 'GET',
  path: '/editor/builder/registries',
  responseType: 'json',
  responseSchema: builderRegistriesResponseSchema,
  summary: 'List available skill registries',
  description: 'Returns the configured external skill registries and their enabled state.',
  tags: ['Editor'],
  requiresAuth: true,
  requiresPermission: 'stored-skills:read',
  handler: async ({ mastra }) => {
    try {
      const registries = await resolveRegistries(mastra);
      return { registries };
    } catch (error) {
      return handleError(error, 'Error listing builder registries');
    }
  },
});

/**
 * GET /editor/builder/registries/:registryId/search
 *
 * Proxies a search query to the underlying registry. Currently only
 * registryId="skills-sh" is supported.
 */
export const BUILDER_REGISTRY_SEARCH_ROUTE = createRoute({
  method: 'GET',
  path: '/editor/builder/registries/:registryId/search',
  responseType: 'json',
  pathParamSchema: builderRegistryPathParams,
  queryParamSchema: builderRegistrySearchQuerySchema,
  responseSchema: skillsShSearchResponseSchema,
  summary: 'Search skills in a registry',
  description: 'Proxies a search request to the configured registry to avoid CORS issues.',
  tags: ['Editor', 'Skills'],
  requiresAuth: true,
  requiresPermission: 'stored-skills:read',
  handler: async ({ mastra, registryId, q, limit }) => {
    try {
      await requireEnabledRegistry(mastra, registryId);
      return await searchSkillsSh({ q, limit });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      return handleError(error, 'Error searching registry');
    }
  },
});

/**
 * GET /editor/builder/registries/:registryId/popular
 *
 * Returns the most popular skills in a registry.
 */
export const BUILDER_REGISTRY_POPULAR_ROUTE = createRoute({
  method: 'GET',
  path: '/editor/builder/registries/:registryId/popular',
  responseType: 'json',
  pathParamSchema: builderRegistryPathParams,
  queryParamSchema: builderRegistryPopularQuerySchema,
  responseSchema: skillsShListResponseSchema,
  summary: 'Get popular skills from a registry',
  description: 'Proxies a popular-skills request to the configured registry to avoid CORS issues.',
  tags: ['Editor', 'Skills'],
  requiresAuth: true,
  requiresPermission: 'stored-skills:read',
  handler: async ({ mastra, registryId, limit, offset }) => {
    try {
      await requireEnabledRegistry(mastra, registryId);
      return await getPopularSkillsSh({ limit, offset });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      return handleError(error, 'Error fetching popular skills');
    }
  },
});

/**
 * GET /editor/builder/registries/:registryId/preview
 *
 * Returns the rendered SKILL.md content for a single skill in the registry.
 */
export const BUILDER_REGISTRY_PREVIEW_ROUTE = createRoute({
  method: 'GET',
  path: '/editor/builder/registries/:registryId/preview',
  responseType: 'json',
  pathParamSchema: builderRegistryPathParams,
  queryParamSchema: builderRegistryPreviewQuerySchema,
  responseSchema: skillsShPreviewResponseSchema,
  summary: 'Preview a skill from a registry',
  description: 'Fetches the SKILL.md content for a single skill in the configured registry.',
  tags: ['Editor', 'Skills'],
  requiresAuth: true,
  requiresPermission: 'stored-skills:read',
  handler: async ({ mastra, registryId, owner, repo, path: skillName }) => {
    try {
      await requireEnabledRegistry(mastra, registryId);
      return await previewSkillsSh({ owner, repo, skillName });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      return handleError(error, 'Error fetching skill preview');
    }
  },
});

/**
 * POST /editor/builder/registries/:registryId/install
 *
 * Fetches the full file tree for a skill from the registry, parses the
 * SKILL.md frontmatter for name/description, and persists everything as a
 * new stored skill. The registry origin is recorded under `metadata.origin`
 * so the UI can surface "imported from skills.sh" badges and re-resolve the
 * source later.
 *
 * Collisions (a stored skill with the derived id already exists) return 409
 * so the UI can offer an "Open existing" link instead of silently
 * overwriting.
 */
export const BUILDER_REGISTRY_INSTALL_ROUTE = createRoute({
  method: 'POST',
  path: '/editor/builder/registries/:registryId/install',
  responseType: 'json',
  pathParamSchema: builderRegistryPathParams,
  bodySchema: builderRegistryInstallBodySchema,
  responseSchema: builderRegistryInstallResponseSchema,
  summary: 'Install a registry skill into stored skills',
  description: 'Fetches a skill from the configured registry and persists it as a new stored skill.',
  tags: ['Editor', 'Skills'],
  requiresAuth: true,
  requiresPermission: 'stored-skills:write',
  handler: async ({ mastra, requestContext, registryId, owner, repo, skillName, visibility: bodyVisibility }) => {
    try {
      await requireEnabledRegistry(mastra, registryId);

      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }
      const skillStore = await storage.getStore('skills');
      if (!skillStore) {
        throw new HTTPException(500, { message: 'Skills storage domain is not available' });
      }

      // Pull files from the registry
      const result = await fetchSkillFiles(owner, repo, skillName);
      if (!result || result.files.length === 0) {
        throw new HTTPException(404, {
          message: `Could not find skill "${skillName}" in ${owner}/${repo}.`,
        });
      }

      const safeSkillId = assertSafeSkillName(result.skillId);
      const files = buildFileTree(result.files);

      // Parse SKILL.md frontmatter into structured fields. Splitting
      // frontmatter (name/description) from the markdown body keeps the
      // body as the agent-facing `instructions` instead of polluting it
      // with raw YAML metadata. SKILL.md missing or unparseable simply
      // yields a null snapshot — registry-provided values then fill in.
      const snapshot = parseSkillSnapshot(result.files);

      const resolvedName = snapshot?.name ?? safeSkillId;
      const description = snapshot?.description ?? `Imported from ${owner}/${repo}`;
      const id = toSlug(resolvedName) || safeSkillId;

      if (!id) {
        throw new HTTPException(400, {
          message: 'Could not derive skill ID from registry skill metadata.',
        });
      }

      // Reject collisions instead of silently overwriting; UI offers "Open existing".
      const existing = await skillStore.getById(id);
      if (existing) {
        throw new HTTPException(409, {
          message: `Skill with id "${id}" already exists.`,
          // Surface the existing id so the client can deep-link.
          cause: { storedSkillId: id },
        });
      }

      // Match the standard create flow: no caller = always public, otherwise default private.
      const authorId = getCallerAuthorId(requestContext) ?? undefined;
      const visibility: 'private' | 'public' = authorId ? (bodyVisibility ?? 'private') : 'public';

      // Use the SKILL.md body (post-frontmatter) as instructions. Frontmatter
      // values are already lifted into structured columns above, so re-storing
      // them in `instructions` would both duplicate metadata and feed YAML
      // into the agent's prompt. Fall back to description when no usable body
      // exists so `resolved.snapshot.instructions` stays non-empty.
      const instructions = snapshot?.instructions?.trim() ? snapshot.instructions : description;

      await skillStore.create({
        skill: {
          id,
          authorId,
          visibility,
          name: resolvedName,
          description,
          instructions,
          files,
          metadata: {
            origin: {
              type: 'skills-sh',
              owner,
              repo,
              skillName,
            },
          },
        },
      });

      return {
        storedSkillId: id,
        name: resolvedName,
        filesWritten: result.files.length,
      };
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      return handleError(error, 'Error installing registry skill');
    }
  },
});
