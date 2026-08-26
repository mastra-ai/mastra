import type { WorkItemCommentRow, WorkItemCommentsStorage } from './base.js';

const MAX_FEED_COMMENTS = 20;
const MAX_COMMENT_CHARS = 2_000;
const MAX_BLOCK_CHARS = 12_000;

function escapeFeedBoundary(value: string): string {
  return value.replaceAll('</work-item-feed>', '&lt;/work-item-feed&gt;');
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function renderComment(comment: WorkItemCommentRow): string {
  const author = comment.author.displayName ?? comment.author.id;
  const header = `[${author} · ${comment.occurredAt.toISOString()}]`;
  const quote = comment.replyTo?.quote
    ? `> ${truncate(comment.replyTo.quote, MAX_COMMENT_CHARS).replaceAll('\n', '\n> ')}\n`
    : '';
  return `${header}\n${quote}${escapeFeedBoundary(truncate(comment.body, MAX_COMMENT_CHARS))}`;
}

/** Renders a work item's recent comments as a kickoff-context block for agent runs. */
export class FactoryFeedReader {
  readonly #comments: Pick<WorkItemCommentsStorage, 'listRecent'>;

  constructor(comments: Pick<WorkItemCommentsStorage, 'listRecent'>) {
    this.#comments = comments;
  }

  async readRunContext(input: { orgId: string; factoryProjectId: string; workItemId: string }): Promise<string | null> {
    const rows = await this.#comments.listRecent({ ...input, limit: MAX_FEED_COMMENTS });
    if (rows.length === 0) return null;
    const oldestFirst = rows.toReversed().map(renderComment);
    // Keep the newest entries when the block would overflow.
    let size = 0;
    let start = oldestFirst.length;
    while (start > 0 && size + oldestFirst[start - 1]!.length + 2 <= MAX_BLOCK_CHARS) {
      size += oldestFirst[start - 1]!.length + 2;
      start -= 1;
    }
    const entries = oldestFirst.slice(start);
    if (entries.length === 0) return null;
    return [
      '<work-item-feed>',
      'Comments left on this work item by the team, oldest first:',
      '',
      entries.join('\n\n'),
      '</work-item-feed>',
    ].join('\n');
  }
}

/** Appends the feed block to a kickoff message; a null context passes the message through untouched. */
export function withFeedContext(message: string, feedContext: string | null): string {
  return feedContext === null ? message : `${message}\n\n${feedContext}`;
}
