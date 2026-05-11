const MASTRA_META_KEY = 'mastra';
const STRICT_META_KEY = 'strict';

export function withMastraToolStrictMeta(
  meta: Record<string, unknown> | undefined,
  strict: boolean | undefined,
): Record<string, unknown> | undefined {
  if (strict == null) {
    return meta;
  }

  const mastraMeta =
    meta?.[MASTRA_META_KEY] && typeof meta[MASTRA_META_KEY] === 'object'
      ? (meta[MASTRA_META_KEY] as Record<string, unknown>)
      : undefined;

  return {
    ...(meta ?? {}),
    [MASTRA_META_KEY]: {
      ...(mastraMeta ?? {}),
      [STRICT_META_KEY]: strict,
    },
  };
}

export function getMastraToolStrictMeta(meta: Record<string, unknown> | undefined): boolean | undefined {
  const mastraMeta = meta?.[MASTRA_META_KEY];
  if (!mastraMeta || typeof mastraMeta !== 'object') {
    return undefined;
  }

  const strict = (mastraMeta as Record<string, unknown>)[STRICT_META_KEY];
  return typeof strict === 'boolean' ? strict : undefined;
}
