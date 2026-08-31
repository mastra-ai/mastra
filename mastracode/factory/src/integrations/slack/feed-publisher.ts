/**
 * Mirrors work-item feed comments into the Slack thread the card was born from.
 *
 * The bot cannot post as the commenter, so attribution is textual: the message
 * reads `**Name**: body` from the app's own identity.
 */

import type { MountedMastraCode } from '@mastra/code-sdk';

import type { WorkItemCommentRow } from '../../storage/domains/comments/base.js';
import type { WorkItemFeedPublisher } from '../../storage/domains/comments/feed-sync.js';
import type { ExternalWorkItemSource, WorkItemRow } from '../../storage/domains/work-items/base.js';

/** Slack rejects a `markdown_text` block over this; comments allow 16k. */
const MAX_SLACK_MARKDOWN = 12_000;

export class SlackFeedPublisher implements WorkItemFeedPublisher {
  readonly id = 'slack';

  readonly #controller: MountedMastraCode['controller'] | undefined;

  constructor({ controller }: { controller?: MountedMastraCode['controller'] }) {
    this.#controller = controller;
  }

  async publish(comment: WorkItemCommentRow, workItem: WorkItemRow): Promise<{ source: ExternalWorkItemSource } | null> {
    const source = workItem.externalSource;
    if (source?.integrationId !== this.id || source.type !== 'slack-thread') return null;

    // Null until the channels' lazy `initialize()` resolves; a comment written
    // in that window is not mirrored, and there is no outbox to retry it.
    const sdk = this.#controller?.getChannels()?.sdk;
    if (!sdk) {
      console.warn('[slack] feed mirror skipped, channels not initialized yet', { commentId: comment.id });
      return null;
    }

    const author = comment.author.displayName ?? comment.author.id;
    const sent = await sdk.thread(source.externalId).post({
      markdown: truncate(`**${author}**: ${comment.body}`),
    });
    return { source: slackCommentSource(source.externalId, sent.id) };
  }
}

function truncate(markdown: string): string {
  if (markdown.length <= MAX_SLACK_MARKDOWN) return markdown;
  // `slice` counts UTF-16 units, so a cut inside an emoji leaves half of a
  // surrogate pair — drop that half rather than post a broken character.
  return `${markdown.slice(0, MAX_SLACK_MARKDOWN - 1).replace(/[\uD800-\uDBFF]$/, '')}…`;
}

/**
 * The one key both sync directions stamp on a mirrored message, so an ingested
 * aside and a mirrored comment can never collide or diverge. Slack thread ids
 * are `slack:<channel>:<ts>`; the channel scopes the otherwise per-channel `ts`.
 */
export function slackCommentSource(threadId: string, messageTs: string): ExternalWorkItemSource {
  return { integrationId: 'slack', type: 'message', externalId: `${threadId.split(':')[1] ?? ''}:${messageTs}` };
}
