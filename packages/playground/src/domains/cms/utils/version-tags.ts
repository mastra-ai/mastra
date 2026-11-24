/** Tag name → version ID, as stored on a stored agent's or prompt block's `metadata.versionTags`. */
export type VersionTags = Record<string, string>;

/** These alias the built-in status selectors on the server, so they can't be tag names. */
const RESERVED_VERSION_TAGS = ['published', 'draft'];
const VERSION_TAG_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;

/** Reads the tag map off a stored agent's or prompt block's metadata, ignoring anything malformed. */
export function readVersionTags(metadata: Record<string, unknown> | undefined): VersionTags {
  const raw = metadata?.versionTags;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const tags: VersionTags = {};
  for (const [name, versionId] of Object.entries(raw)) {
    if (typeof versionId === 'string' && versionId) tags[name] = versionId;
  }
  return tags;
}

/** Mirrors the server's tag name rules so the form can explain a bad name before saving. */
export function getVersionTagNameError(name: string): string | undefined {
  if (RESERVED_VERSION_TAGS.includes(name)) {
    return `"${name}" is reserved. Pick another name.`;
  }
  if (!VERSION_TAG_NAME_PATTERN.test(name)) {
    return 'Use letters, digits, ".", "_" or "-", starting with a letter or digit (63 characters at most).';
  }
  return undefined;
}
