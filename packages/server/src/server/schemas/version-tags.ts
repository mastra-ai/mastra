import { z } from 'zod/v4';

/**
 * Key on a versioned entity's `metadata` that holds its version tags: a map of tag name → version ID.
 * Tags are named pointers to a version, like `activeVersionId` but with a caller-chosen name.
 */
export const VERSION_TAGS_METADATA_KEY = 'versionTags';

/** Names that alias the built-in `status` selectors and so can't be used as tag names. */
export const RESERVED_VERSION_TAGS = ['published', 'draft'] as const;

export const MAX_VERSION_TAGS = 20;

const VERSION_TAG_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;

export const versionTagNameSchema = z
  .string()
  .regex(
    VERSION_TAG_NAME_PATTERN,
    'Version tag names must be 1-63 characters, start with a letter or digit, and contain only letters, digits, ".", "_" or "-"',
  )
  .refine(name => !(RESERVED_VERSION_TAGS as readonly string[]).includes(name), {
    message: `"${RESERVED_VERSION_TAGS.join('" and "')}" are reserved and cannot be used as version tag names`,
  });

/** Map of tag name → version ID. Sending the map replaces the entity's whole tag set. */
export const versionTagsSchema = z.record(z.string(), z.unknown()).superRefine((tags, ctx) => {
  const names = Object.keys(tags);
  if (names.length > MAX_VERSION_TAGS) {
    ctx.addIssue({ code: 'custom', message: `At most ${MAX_VERSION_TAGS} version tags can be set` });
  }
  // Names are checked one by one (rather than as a record key schema) so the error says what is wrong with the name.
  for (const name of names) {
    const parsedName = versionTagNameSchema.safeParse(name);
    if (!parsedName.success) {
      ctx.addIssue({ code: 'custom', message: parsedName.error.issues[0]!.message, path: [name] });
    }
    const versionId = tags[name];
    if (typeof versionId !== 'string' || !versionId) {
      ctx.addIssue({ code: 'custom', message: 'A version tag must point to a version ID', path: [name] });
    }
  }
});

/**
 * Free-form entity metadata, except that `versionTags` (when present) must be a valid tag map.
 * Whether each tagged version exists is checked by the handler.
 */
export const metadataWithVersionTagsSchema = z.record(z.string(), z.unknown()).superRefine((metadata, ctx) => {
  if (!(VERSION_TAGS_METADATA_KEY in metadata)) return;
  const parsed = versionTagsSchema.safeParse(metadata[VERSION_TAGS_METADATA_KEY]);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    ctx.addIssue({
      code: 'custom',
      message: issue.message,
      path: [VERSION_TAGS_METADATA_KEY, ...issue.path],
    });
  }
});
