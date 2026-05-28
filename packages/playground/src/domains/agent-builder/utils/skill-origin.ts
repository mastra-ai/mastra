/**
 * Helpers for reading the `metadata.origin` field on stored skills. Skills
 * that were imported from an external registry (skills.sh today, more later)
 * carry their provenance here so the UI can show a badge and link back.
 *
 * The shape lines up with `skillOriginSchema` in
 * `packages/server/src/server/schemas/stored-skills.ts`. We narrow at the
 * boundary because `StoredSkillResponse.metadata` is loosely typed as
 * `Record<string, unknown>` on the wire.
 */

export interface SkillsShOrigin {
  type: 'skills-sh';
  owner: string;
  repo: string;
  skillName: string;
}

export interface LibraryCopyOrigin {
  type: 'library-copy';
  sourceSkillId: string;
  sourceSkillName: string;
  sourceAuthorId?: string;
}

export type SkillOrigin = SkillsShOrigin | LibraryCopyOrigin;

export function getSkillOrigin(metadata: Record<string, unknown> | undefined | null): SkillOrigin | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const origin = (metadata as { origin?: unknown }).origin;
  if (!origin || typeof origin !== 'object') return null;
  const candidate = origin as Record<string, unknown>;
  if (
    candidate.type === 'skills-sh' &&
    typeof candidate.owner === 'string' &&
    typeof candidate.repo === 'string' &&
    typeof candidate.skillName === 'string'
  ) {
    return {
      type: 'skills-sh',
      owner: candidate.owner,
      repo: candidate.repo,
      skillName: candidate.skillName,
    };
  }
  if (
    candidate.type === 'library-copy' &&
    typeof candidate.sourceSkillId === 'string' &&
    typeof candidate.sourceSkillName === 'string'
  ) {
    return {
      type: 'library-copy',
      sourceSkillId: candidate.sourceSkillId,
      sourceSkillName: candidate.sourceSkillName,
      sourceAuthorId: typeof candidate.sourceAuthorId === 'string' ? candidate.sourceAuthorId : undefined,
    };
  }
  return null;
}

/**
 * Build a human-readable label for an origin (e.g. `skills.sh · owner/repo`).
 */
export function formatSkillOriginLabel(origin: SkillOrigin): string {
  switch (origin.type) {
    case 'skills-sh':
      return `skills.sh · ${origin.owner}/${origin.repo}`;
    case 'library-copy':
      return `Copied from "${origin.sourceSkillName}"`;
    default:
      return 'imported';
  }
}

/**
 * Build the upstream URL for an origin, when known.
 */
export function getSkillOriginUrl(origin: SkillOrigin): string | null {
  switch (origin.type) {
    case 'skills-sh':
      return `https://skills.sh/${origin.owner}/${origin.repo}/${origin.skillName}`;
    case 'library-copy':
      return null;
    default:
      return null;
  }
}
