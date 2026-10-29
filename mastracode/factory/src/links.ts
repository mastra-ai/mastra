/**
 * Web UI links to Factory entities, so channels (Slack, TUI, GitHub) can point people at the exact
 * thing instead of telling them to "go use the UI". Every builder returns undefined when
 * `MASTRACODE_PUBLIC_URL` is unset or blank: an unconfigured server has no address to link to.
 */

/** The configured web UI origin, trimmed and without a trailing slash; null when unset or blank. */
export function factoryUiOrigin(raw: string | undefined = process.env.MASTRACODE_PUBLIC_URL): string | null {
  return raw?.trim().replace(/\/+$/, '') || null;
}

function factoryUrl(factoryProjectId: string, path: string): string | undefined {
  const origin = factoryUiOrigin();
  return origin ? `${origin}/factories/${encodeURIComponent(factoryProjectId)}${path}` : undefined;
}

/** Board path segment: the built-in boards have their own routes, others live under /boards/:id. */
function boardSegment(board: string): string {
  return board === 'work' || board === 'review' ? `/${board}` : `/boards/${encodeURIComponent(board)}`;
}

export function factoryBoardUrl(factoryProjectId: string, board: string): string | undefined {
  return factoryUrl(factoryProjectId, boardSegment(board));
}

/** A card opened on its board, optionally scrolled to one feed comment. */
export function factoryWorkItemUrl(input: {
  factoryProjectId: string;
  board: string;
  workItemId: string;
  commentId?: string;
}): string | undefined {
  const query = new URLSearchParams({ item: input.workItemId });
  if (input.commentId) query.set('comment', input.commentId);
  return factoryUrl(input.factoryProjectId, `${boardSegment(input.board)}?${query}`);
}

export function factorySessionUrl(input: {
  factoryProjectId: string;
  sessionId: string;
  threadId: string;
}): string | undefined {
  return factoryUrl(
    input.factoryProjectId,
    `/workspaces/${encodeURIComponent(input.sessionId)}/threads/${encodeURIComponent(input.threadId)}`,
  );
}

/** A settings page, e.g. `models`, `general`, or `connections/slack`. */
export function factorySettingsUrl(factoryProjectId: string, section: string): string | undefined {
  return factoryUrl(factoryProjectId, `/settings/${section.split('/').map(encodeURIComponent).join('/')}`);
}

export function factoryRulesUrl(factoryProjectId: string, group?: string): string | undefined {
  return factoryUrl(factoryProjectId, group ? `/rules?${new URLSearchParams({ group })}` : '/rules');
}
