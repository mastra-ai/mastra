import { HTTPException } from '../http-exception';
import { RESERVED_VERSION_TAGS, VERSION_TAGS_METADATA_KEY } from '../schemas/version-tags';

type TaggedRecord = { metadata?: Record<string, unknown> | null } | null | undefined;

/** Reads the tag name → version ID map off a versioned entity's metadata. Malformed entries are ignored. */
export function getVersionTags(record: TaggedRecord): Record<string, string> {
  const raw = record?.metadata?.[VERSION_TAGS_METADATA_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const tags: Record<string, string> = {};
  for (const [name, versionId] of Object.entries(raw)) {
    if (typeof versionId === 'string' && versionId) tags[name] = versionId;
  }
  return tags;
}

/** IDs of every version a tag points at. These must survive retention pruning and deletion. */
export function getTaggedVersionIds(record: TaggedRecord): Set<string> {
  return new Set(Object.values(getVersionTags(record)));
}

/** Names of the tags pointing at one version. */
export function getTagsForVersion(record: TaggedRecord, versionId: string): string[] {
  return Object.entries(getVersionTags(record))
    .filter(([, taggedVersionId]) => taggedVersionId === versionId)
    .map(([name]) => name);
}

export function isReservedVersionTag(tag: string): tag is (typeof RESERVED_VERSION_TAGS)[number] {
  return (RESERVED_VERSION_TAGS as readonly string[]).includes(tag);
}

/**
 * Rejects a tag map that points at a version that doesn't exist or belongs to another entity.
 * Only tags that are new or moved are looked up, so an unrelated metadata edit never fails
 * because of a tag that was already there.
 */
export async function assertVersionTagTargetsExist({
  metadata,
  existing,
  entityId,
  parentIdField,
  getVersion,
}: {
  metadata: Record<string, unknown> | undefined;
  existing: TaggedRecord;
  entityId: string;
  parentIdField: string;
  getVersion: (versionId: string) => Promise<unknown>;
}): Promise<void> {
  if (!metadata || !(VERSION_TAGS_METADATA_KEY in metadata)) return;

  const current = getVersionTags(existing);
  const next = getVersionTags({ metadata });

  for (const [name, versionId] of Object.entries(next)) {
    if (current[name] === versionId) continue;
    const version = (await getVersion(versionId)) as Record<string, unknown> | null;
    if (!version || version[parentIdField] !== entityId) {
      throw new HTTPException(400, {
        message: `Cannot set version tag "${name}": version ${versionId} not found for ${entityId}`,
      });
    }
  }
}
