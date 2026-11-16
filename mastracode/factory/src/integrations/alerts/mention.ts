import type { Card, WorkItemsStorage } from '../../storage/domains/work-items/base.js';

import { updateCardMetadata } from './card-metadata.js';
import { ALERT_STATE_KEY, ALERT_TIMELINE_KEY, findAlertCardForThread } from './rules.js';
import { ALERT_TIMELINE_MAX } from './state.js';
import type { AlertCardState, AlertTimelineEntry } from './state.js';

const MENTION_TEXT_MAX = 500;

export interface AlertThreadCard {
  id: string;
  orgId: string;
  factoryProjectId: string;
  /** What a session started from the alert thread is told about the card. */
  preamble: string;
}

/** Lets the Slack mention handler land a mention in an alert's thread on that alert's card. */
export interface AlertThreads {
  find(thread: { teamId: string; threadId: string }): Promise<AlertThreadCard | null>;
  recordMention(card: AlertThreadCard, mention: { author: string; text: string; at: Date }): Promise<void>;
}

export function createAlertThreads(
  storage: Pick<WorkItemsStorage, 'getBySource' | 'get' | 'update'>,
  options: { workItemUrl?: (card: Card) => string | undefined } = {},
): AlertThreads {
  return {
    async find(thread) {
      const card = await findAlertCardForThread(storage, thread);
      if (!card) return null;
      return {
        id: card.id,
        orgId: card.orgId,
        factoryProjectId: card.factoryProjectId,
        preamble: preamble(card, options.workItemUrl?.(card)),
      };
    },
    async recordMention(ref, mention) {
      const entry: AlertTimelineEntry = {
        at: mention.at.toISOString(),
        kind: 'mention',
        text: `${mention.author}: ${mention.text.slice(0, MENTION_TEXT_MAX)}`,
      };
      await updateCardMetadata(storage, { orgId: ref.orgId, id: ref.id, userId: 'factory-slack' }, card => {
        const timeline = (card.metadata?.[ALERT_TIMELINE_KEY] as AlertTimelineEntry[] | undefined) ?? [];
        return { [ALERT_TIMELINE_KEY]: [...timeline, entry].slice(-ALERT_TIMELINE_MAX) };
      });
    },
  };
}

function preamble(card: Card, url: string | undefined): string {
  const state = card.metadata?.[ALERT_STATE_KEY] as AlertCardState | undefined;
  const incidents = state ? Object.keys(state.incidents) : [];
  return [
    `This Slack thread is a Mastra alert. Its Factory work item is "${card.title}" (id ${card.id}${url ? `, ${url}` : ''}).`,
    state
      ? `It has fired ${state.fireCount} time(s); severity ${state.severity}. Incident ids: ${incidents.join(', ') || 'none'}.`
      : '',
    'Use factory_inspect_work_item for its description and history, and the alert_* tools with an incident id to read its traces, logs and metrics.',
  ]
    .filter(Boolean)
    .join('\n');
}
