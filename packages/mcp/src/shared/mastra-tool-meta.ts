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
 * Mirrors a tool's UI resource URI across the canonical nested `_meta.ui.resourceUri`
 * and its legacy flat alias, so hosts that only understand one of the two forms
 * resolve the same MCP App.
 *
 * Shared by the `tools/list` and `tools/call` handlers: MCP Apps hosts resolve which
 * app to render from the tool-call result's `_meta`, so emitting it in only one of
 * the two leaves non-Studio hosts unable to open the app.
 */
export function normalizeToolUiMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) {
    return meta;
  }

  const uiMeta = meta.ui as { resourceUri?: string } | undefined;
  const nestedUri = uiMeta?.resourceUri;
  const legacyUri = meta[RESOURCE_URI_META_KEY] as string | undefined;

  // The nested form is canonical and the flat key is its alias, so when both are
  // present but disagree the nested value overwrites the alias. Leaving them
  // divergent would let one tool advertise two different resource URIs, and a host
  // picking whichever key it understands would render a different app than declared.
  if (nestedUri) {
    return legacyUri === nestedUri ? meta : { ...meta, [RESOURCE_URI_META_KEY]: nestedUri };
  }
  if (legacyUri) {
    return { ...meta, ui: { ...((meta.ui as object) ?? {}), resourceUri: legacyUri } };
  }
  return meta;
}

/**
 * Merges a tool's declared `_meta` with the `_meta` its `execute()` returned.
 *
 * Author metadata wins on collision, except that `ui` is merged key by key rather
 * than replaced: `ui` is a namespace (a tool may declare `visibility` alongside
 * `resourceUri`), so replacing it wholesale would drop sibling keys, and an author
 * `ui` carrying no `resourceUri` would strip the declared nested URI while the
 * mirrored flat key survived, leaving the two forms disagreeing.
 */
export function mergeToolMeta(
  declared: Record<string, unknown> | undefined,
  author: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!declared && !author) {
    return undefined;
  }

  const merged: Record<string, unknown> = { ...declared, ...author };
  const declaredUi = declared?.ui;
  const authorUi = author?.ui;
  if (declaredUi && authorUi && typeof declaredUi === 'object' && typeof authorUi === 'object') {
    merged.ui = { ...(declaredUi as Record<string, unknown>), ...(authorUi as Record<string, unknown>) };
  }
  return merged;
}
