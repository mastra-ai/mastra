/**
 * Mirrors work-item feed comments into the Slack thread the card was born from.
 * The bot cannot post as the commenter, so attribution is textual: `**Name**: body`.
 */

import type { MountedMastraCode } from '@mastra/code-sdk';

import type { WorkItemCommentRow } from '../../storage/domains/comments/base.js';
import type { WorkItemFeedPublisher } from '../../storage/domains/comments/feed-sync.js';
import type { ExternalWorkItemSource, WorkItemRow } from '../../storage/domains/work-items/base.js';

/** Slack rejects a `markdown_text` block over this; comments allow 16k. */
const MAX_SLACK_MARKDOWN_CHARS = 12_000;

export class SlackFeedPublisher implements WorkItemFeedPublisher {
  readonly id = 'slack';

  readonly #controller: MountedMastraCode['controller'] | undefined;

  constructor({ controller }: { controller?: MountedMastraCode['controller'] }) {
    this.#controller = controller;
  }

  async publish(comment: WorkItemCommentRow, workItem: WorkItemRow): Promise<{ source: ExternalWorkItemSource } | null> {
    const source = workItem.externalSource;
    if (source?.integrationId !== this.id || source.type !== 'slack-thread') return null;

    // Null until the channels' lazy `initialize()` resolves; no outbox retries.
    const sdk = this.#controller?.getChannels()?.sdk;
    if (!sdk) {
      console.warn('[slack] feed mirror skipped, channels not initialized yet', { commentId: comment.id });
      return null;
    }

    const author = comment.author.displayName ?? comment.author.id;
    const sent = await sdk.thread(source.externalId).post({
      markdown: fitSlackMarkdown(`**${author}**: ${comment.body}`),
    });
    return { source: slackCommentSource(source.externalId, sent.id, source.workspaceId) };
  }
}

function fitSlackMarkdown(markdown: string): string {
  if (markdown.length <= MAX_SLACK_MARKDOWN_CHARS) return markdown;
  // `slice` counts UTF-16 units, so a cut inside an emoji leaves half a pair.
  return `${markdown.slice(0, MAX_SLACK_MARKDOWN_CHARS - 1).replace(/[\uD800-\uDBFF]$/, '')}…`;
}

/**
 * The one key both sync directions stamp on a mirrored message, so an ingested
 * aside and a mirrored comment cannot diverge. Workspace-scoped like the card's
 * own key: a channel id and a `ts` only identify a message inside the team that
 * issued them, and one project can hold two Slack workspaces.
 */
export function slackCommentSource(threadId: string, messageTs: string, teamId?: string): ExternalWorkItemSource {
  return {
    integrationId: 'slack',
    type: 'message',
    ...(teamId ? { workspaceId: teamId } : {}),
    externalId: `${threadId.split(':')[1] ?? ''}:${messageTs}`,
  };
}
