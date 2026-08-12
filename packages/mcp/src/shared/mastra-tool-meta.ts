import { RESOURCE_URI_META_KEY } from '@modelcontextprotocol/ext-apps';

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

/**
 * Normalizes a tool's UI metadata for backward compatibility with older hosts:
 * if `_meta.ui.resourceUri` is set, mirror it onto the legacy flat key, and vice versa.
 *
 * Shared by the `tools/list` and `tools/call` handlers so both advertise the same
 * resource URI. MCP Apps hosts resolve which app to render from the tool-call
 * result's `_meta`, so emitting it in only one of the two leaves non-Studio hosts
 * unable to open the app.
 */
export function normalizeToolUiMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) {
    return meta;
  }

  const uiMeta = meta.ui as { resourceUri?: string } | undefined;
  const legacyUri = meta[RESOURCE_URI_META_KEY] as string | undefined;

  if (uiMeta?.resourceUri && !legacyUri) {
    return { ...meta, [RESOURCE_URI_META_KEY]: uiMeta.resourceUri };
  }
  if (legacyUri && !uiMeta?.resourceUri) {
    return { ...meta, ui: { ...((meta.ui as object) ?? {}), resourceUri: legacyUri } };
  }
  return meta;
}
