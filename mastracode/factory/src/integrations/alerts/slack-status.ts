import { createTool } from '@mastra/core/tools';
import type { Chat } from 'chat';
import { z } from 'zod';

import { factoryWorkItemUrl } from '../../links.js';
import type { Card, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { FactoryRunOutcome } from '../../tools/reports.js';
import { updateCardMetadata } from './card-metadata.js';
import { ALERT_TIMELINE_KEY } from './rules.js';
import { alertSlackThreadOf } from './run-thread.js';

/** Card metadata key holding the Factory's messages in the alert's Slack thread. */
export const ALERT_SLACK_STATUS_KEY = 'alertSlackStatus';

/**
 * `filed`: the card exists, nothing is working on it. `ended`: a run finished without saying
 * what it found, so the status would otherwise read "looking into it" forever.
 */
export type AlertTriageStage = 'filed' | 'investigating' | 'diagnosed' | 'fix_up' | 'no_fix' | 'ended' | 'failed';

/** The Factory's messages in the thread: the status it edits, and one diagnosis and one fix reply. */
export type AlertMessageSlot = 'status' | 'diagnosis' | 'fix';

/**
 * A message the Factory posts once. The slot is claimed in the card's metadata before posting, so
 * two replicas (or two calls) never both post; `ts` is set once the post lands. A claim with no
 * `ts` older than {@link CLAIM_STALE_MS} belongs to a post that never landed and may be taken over.
 * The card holds what the message should say (`text` for a reply; the status renders from the
 * record) and what Slack last took (`shown`), so a failed or overtaken edit is redone later.
 */
interface PostedMessage {
  ts?: string;
  claimedAt: string;
  text?: string;
  shown?: string;
}

export interface AlertSlackStatusRecord {
  stage: AlertTriageStage;
  pullRequestUrl?: string;
  reason?: string;
  recoveredAt?: string;
  messages: Partial<Record<AlertMessageSlot, PostedMessage>>;
  /** The reaction last put on the alert message. */
  reaction?: string | null;
}

const CLAIM_STALE_MS = 2 * 60_000;
/** Re-reads after an edit, in case a newer write landed meanwhile; bounded so writers can't ping-pong forever. */
const SYNC_PASSES = 3;
const WORKING: ReadonlySet<AlertTriageStage> = new Set(['investigating', 'diagnosed']);
const CONCLUDED: ReadonlySet<AlertTriageStage> = new Set(['fix_up', 'no_fix']);
/** A new run restarts the status from here; after a fix or a written conclusion it stays put. */
const RESTARTABLE: ReadonlySet<AlertTriageStage> = new Set(['filed', 'ended', 'failed']);
const STATUS_USER_ID = 'factory-rule-dispatcher';

export interface AlertThreadRef {
  teamId: string;
  channelId: string;
  /** Chat thread id, `slack:<channel>:<root ts>`. */
  threadId: string;
  /** The alert message's ts: the thread root. */
  rootTs: string;
}

/** The few Slack calls the status needs, so tests can record them. */
export interface AlertSlackClient {
  /** True when the Factory's Slack app is installed in the thread's workspace and is in its channel. */
  covers(thread: { teamId: string; channelId: string }): Promise<boolean>;
  post(thread: AlertThreadRef, markdown: string): Promise<string>;
  edit(thread: AlertThreadRef, ts: string, markdown: string): Promise<void>;
  react(thread: AlertThreadRef, ts: string, emoji: string): Promise<void>;
  unreact(thread: AlertThreadRef, ts: string, emoji: string): Promise<void>;
}

interface SlackWebClientLike {
  auth: { test(): Promise<{ team_id?: string }> };
  conversations: { info(args: { channel: string }): Promise<{ channel?: { is_member?: boolean } }> };
}

interface SlackAdapterLike {
  getInstallation?(teamId: string): Promise<{ botToken?: string } | null>;
  withBotToken?<T>(token: string, fn: () => T): T;
  readonly webClient: SlackWebClientLike;
  postMessage(threadId: string, message: { markdown: string }): Promise<{ id: string }>;
  editMessage(threadId: string, messageId: string, message: { markdown: string }): Promise<unknown>;
  addReaction(threadId: string, messageId: string, emoji: string): Promise<void>;
  removeReaction(threadId: string, messageId: string, emoji: string): Promise<void>;
}

/**
 * Posts through the Factory's own Slack adapter, outside any run: with the workspace's stored bot
 * token when the app is installed per workspace, else with the adapter's default token, which
 * only covers the workspace it was issued for.
 */
export function chatAlertSlackClient(chat: () => Chat | null | undefined): AlertSlackClient {
  const adapterOf = () => {
    const adapter = chat()?.getAdapter('slack') as SlackAdapterLike | undefined;
    if (!adapter) throw new Error('The Factory has no Slack adapter.');
    return adapter;
  };
  const withWorkspace = async <T>(
    teamId: string,
    fn: (adapter: SlackAdapterLike, installed: boolean) => Promise<T>,
  ): Promise<T> => {
    const adapter = adapterOf();
    const installation = await adapter.getInstallation?.(teamId).catch(() => null);
    return installation?.botToken && adapter.withBotToken
      ? adapter.withBotToken(installation.botToken, () => fn(adapter, true))
      : fn(adapter, false);
  };
  return {
    covers: thread =>
      withWorkspace(thread.teamId, async (adapter, installed) => {
        if (!installed && (await adapter.webClient.auth.test()).team_id !== thread.teamId) return false;
        return (await adapter.webClient.conversations.info({ channel: thread.channelId })).channel?.is_member === true;
      }).catch(() => false),
    post: (thread, markdown) =>
      withWorkspace(thread.teamId, async adapter => (await adapter.postMessage(thread.threadId, { markdown })).id),
    edit: (thread, ts, markdown) =>
      withWorkspace(thread.teamId, async adapter => {
        await adapter.editMessage(thread.threadId, ts, { markdown });
      }),
    react: (thread, ts, emoji) =>
      withWorkspace(thread.teamId, adapter => adapter.addReaction(thread.threadId, ts, emoji)),
    unreact: (thread, ts, emoji) =>
      withWorkspace(thread.teamId, adapter => adapter.removeReaction(thread.threadId, ts, emoji)),
  };
}

/** Whether a reaction call took effect: it succeeded, or Slack says the reaction is already so. */
async function settled(call: Promise<void>, alreadySo: string): Promise<boolean> {
  try {
    await call;
    return true;
  } catch (error) {
    return String((error as { data?: { error?: string } })?.data?.error ?? (error as Error)?.message).includes(alreadySo);
  }
}

/**
 * The reaction on the alert message. ✅ only once the alert has recovered: a fix up for review
 * is not the end of it, and a green check would tell people to stop watching the thread.
 */
const STAGE_REACTION: Record<AlertTriageStage, string | null> = {
  filed: null,
  investigating: 'eyes',
  diagnosed: 'eyes',
  fix_up: 'hammer_and_wrench',
  no_fix: 'information_source',
  ended: 'information_source',
  failed: 'warning',
};

function reactionFor(status: AlertSlackStatusRecord | null): string | null {
  if (!status) return null;
  return status.recoveredAt ? 'white_check_mark' : STAGE_REACTION[status.stage];
}

function recoveredAtText(at: Date): string {
  return `${at.toISOString().slice(11, 16)} UTC`;
}

/** The recovery the card already records, for a status first written after it (thread linked late). */
function recordedRecovery(card: Card): Pick<AlertSlackStatusRecord, 'recoveredAt'> {
  const timeline = card.metadata?.[ALERT_TIMELINE_KEY];
  if (!Array.isArray(timeline)) return {};
  const last = (timeline as Array<{ kind?: string; at?: string }>)
    .filter(entry => entry.kind !== 'mention' && entry.kind !== 'severity_raised')
    .at(-1);
  return last?.kind === 'recovered' && last.at ? { recoveredAt: recoveredAtText(new Date(last.at)) } : {};
}

function threadOf(card: Card): AlertThreadRef | null {
  const thread = alertSlackThreadOf(card);
  const rootTs = thread?.threadId.split(':')[2];
  return thread && rootTs ? { ...thread, rootTs } : null;
}

export function readAlertSlackStatus(card: Card): AlertSlackStatusRecord | null {
  const value = card.metadata?.[ALERT_SLACK_STATUS_KEY];
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<AlertSlackStatusRecord>;
  return typeof record.stage === 'string'
    ? ({ ...record, messages: record.messages ?? {} } as AlertSlackStatusRecord)
    : null;
}

export function alertStatusText(status: AlertSlackStatusRecord, cardUrl: string | null): string {
  const card = cardUrl ? ` · [Factory card](${cardUrl})` : '';
  const head = {
    filed: '📋 *Filed in the Factory.*',
    investigating: "👀 *Factory is looking into this alert.* Reading the incident's traces, logs and metrics.",
    diagnosed: '🔎 *Cause found.* Working on a fix; the diagnosis is below.',
    fix_up: `🛠️ *Fix is up for review*${status.pullRequestUrl ? `: ${status.pullRequestUrl}` : '.'} Not merged.`,
    no_fix: '🔎 *Diagnosed, no code fix from the Factory.* Details below.',
    ended: '🔎 *Factory triage ended without a written conclusion.* The card has what it found.',
    failed: `⚠️ *Factory triage stopped${status.reason ? `:* ${status.reason}` : '.*'}`,
  }[status.stage];
  const recovered = status.recoveredAt ? `\n✅ _The alert recovered at ${status.recoveredAt}._` : '';
  return `${head}${card}${recovered}`;
}

type StatusChange = (previous: AlertSlackStatusRecord | null) => Partial<AlertSlackStatusRecord> | null;

/**
 * The Factory's messages in an alert's Slack thread, plus the reaction on the alert itself. One
 * status message, posted once the thread is linked and edited in place as triage moves on:
 * 📋 filed → 👀 looking → cause found → fix up (🛠️) / no fix (ℹ️) / ended (ℹ️) / stopped (⚠️);
 * ✅ once the alert recovers. The diagnosis and the fix are one reply each (`alert_post_update`);
 * re-fires and flaps post nothing. Every message is claimed on the card before it is posted, so
 * replicas and repeated calls edit what is there instead of posting again.
 */
export class AlertSlackStatus {
  readonly #client: AlertSlackClient;
  readonly #workItems: Pick<WorkItemsStorage, 'get' | 'update'>;
  readonly #cardUrl: (card: Card) => string | null;
  readonly #now: () => Date;

  constructor(deps: {
    client: AlertSlackClient;
    workItems: Pick<WorkItemsStorage, 'get' | 'update'>;
    cardUrl?: (card: Card) => string | null;
    now?: () => Date;
  }) {
    this.#client = deps.client;
    this.#workItems = deps.workItems;
    this.#cardUrl =
      deps.cardUrl ??
      (card =>
        factoryWorkItemUrl({
          factoryProjectId: card.factoryProjectId,
          workItemId: card.id,
        }) ?? null);
    this.#now = deps.now ?? (() => new Date());
  }

  /** True when the Factory's Slack app can post in the thread; otherwise Platform posts the card link. */
  covers(thread: { teamId: string; channelId: string }): Promise<boolean> {
    return this.#client.covers(thread);
  }

  /** The thread was linked to the card: say it is filed, when the Factory's app can post there. */
  async linked(card: Card): Promise<boolean> {
    const thread = threadOf(card);
    if (!thread || !(await this.covers(thread))) return false;
    return this.#writeStatus(card, previous => (previous ? null : { stage: 'filed' }));
  }

  /** A run started on the card. A concluded triage keeps its status. */
  async runStarted(card: Card): Promise<boolean> {
    const thread = threadOf(card);
    if (!thread) return false;
    // With no status yet, Platform may own the thread's reply: only post where the app can.
    if (!readAlertSlackStatus(card) && !(await this.covers(thread))) return false;
    return this.#writeStatus(card, previous =>
      !previous || RESTARTABLE.has(previous.stage) ? { stage: 'investigating', reason: undefined } : null,
    );
  }

  /** A run on the card ended. A run that stopped without concluding says so instead of looking busy. */
  async runEnded(card: Card, outcome: FactoryRunOutcome): Promise<boolean> {
    if (outcome.status === 'blocked') return false;
    return this.#writeStatus(card, previous => {
      if (!previous || !WORKING.has(previous.stage)) return null;
      return outcome.status === 'failed'
        ? { stage: 'failed', reason: outcome.reason.slice(0, 300) }
        : { stage: 'ended' };
    });
  }

  async concluded(card: Card, stage: 'diagnosed' | 'fix_up' | 'no_fix', pullRequestUrl?: string): Promise<boolean> {
    return this.#writeStatus(card, previous => {
      // A diagnosis after the fix is a correction to it; the status stays on the fix.
      if (stage === 'diagnosed' && previous && CONCLUDED.has(previous.stage)) return null;
      return { stage, reason: undefined, ...(pullRequestUrl ? { pullRequestUrl } : {}) };
    });
  }

  /** Notes a recovery on the status message; no new reply. */
  async recovered(card: Card, at: Date): Promise<boolean> {
    const recoveredAt = recoveredAtText(at);
    return this.#writeStatus(card, previous => (previous ? { recoveredAt } : null));
  }

  /** The diagnosis or fix reply. A second call edits the first reply instead of posting another. */
  async reply(card: Card, slot: 'diagnosis' | 'fix', markdown: string): Promise<boolean> {
    return this.#write(card, slot, () => ({}), markdown);
  }

  #writeStatus(card: Card, change: StatusChange): Promise<boolean> {
    return this.#write(card, 'status', change);
  }

  #render(card: Card, status: AlertSlackStatusRecord, slot: AlertMessageSlot): string {
    return slot === 'status' ? alertStatusText(status, this.#cardUrl(card)) : (status.messages[slot]?.text ?? '');
  }

  /**
   * Records the change on the card, then brings Slack in line with the card: posts the message if
   * this call claimed it, edits it while Slack shows something older, and sets the reaction. Runs
   * even when the change is a no-op, so a post or edit that failed earlier is redone. Returns
   * whether the change applied.
   */
  async #write(card: Card, slot: AlertMessageSlot, change: StatusChange, text?: string): Promise<boolean> {
    const thread = threadOf(card);
    if (!thread) return false;
    let claimed = false;
    let applied = false;
    let exists = false;
    const now = this.#now();
    await updateCardMetadata(this.#workItems, { orgId: card.orgId, id: card.id, userId: STATUS_USER_ID }, current => {
      claimed = false;
      const previous = readAlertSlackStatus(current);
      const changed = change(previous);
      applied = changed !== null;
      exists = applied || previous !== null;
      if (!exists) return null;
      const next: AlertSlackStatusRecord = {
        ...(previous ?? { stage: 'filed', ...recordedRecovery(current) }),
        ...changed,
        messages: { ...previous?.messages },
      };
      let message = next.messages[slot];
      if (!message?.ts && (!message || now.getTime() - Date.parse(message.claimedAt) > CLAIM_STALE_MS)) {
        claimed = true;
        message = { ...message, claimedAt: now.toISOString() };
      }
      if (text !== undefined && message?.text !== text) message = { ...message!, text };
      if (!changed && message === next.messages[slot]) return null;
      if (message) next.messages[slot] = message;
      return { [ALERT_SLACK_STATUS_KEY]: next };
    });
    if (!exists) return false;
    if (claimed) await this.#post(card, thread, slot);
    await this.#syncMessage(card, thread, slot);
    if (slot === 'status') await this.#syncReaction(card, thread);
    return applied;
  }

  async #current(card: Card): Promise<AlertSlackStatusRecord | null> {
    const current = await this.#workItems.get({ orgId: card.orgId, id: card.id });
    return current && readAlertSlackStatus(current);
  }

  /** Posts the claimed message with what the card says now. A refused post drops the claim, keeping a reply's text. */
  async #post(card: Card, thread: AlertThreadRef, slot: AlertMessageSlot): Promise<void> {
    const latest = await this.#current(card);
    if (!latest) return;
    const text = this.#render(card, latest, slot);
    let ts: string;
    try {
      ts = await this.#client.post(thread, text);
    } catch (error) {
      await this.#setMessage(card, slot, message =>
        message?.ts ? message : message?.text ? { text: message.text, claimedAt: new Date(0).toISOString() } : undefined,
      ).catch(() => undefined);
      throw error;
    }
    await this.#setMessage(card, slot, message => ({ ...message, claimedAt: message?.claimedAt ?? this.#now().toISOString(), ts, shown: text }));
  }

  /**
   * Edits the message until Slack took what the card says. An edit that finishes after a newer
   * one records what it showed, so the next pass (here or in the newer writer) puts the latest back.
   * Without a ts the claim holder is still posting, and syncs once it has.
   */
  async #syncMessage(card: Card, thread: AlertThreadRef, slot: AlertMessageSlot): Promise<void> {
    for (let pass = 0; pass < SYNC_PASSES; pass++) {
      const latest = await this.#current(card);
      const message = latest?.messages[slot];
      if (!latest || !message?.ts) return;
      const text = this.#render(card, latest, slot);
      if (text === message.shown) return;
      await this.#client.edit(thread, message.ts, text);
      await this.#setMessage(card, slot, current => (current && current.ts === message.ts ? { ...current, shown: text } : current));
    }
  }

  /**
   * Puts the latest stage's reaction on the alert, removing a stale one another writer added. Only
   * a reaction change Slack confirmed is recorded, so a refused one is redone on the next write.
   */
  async #syncReaction(card: Card, thread: AlertThreadRef): Promise<void> {
    for (let pass = 0; pass < SYNC_PASSES; pass++) {
      const latest = await this.#current(card);
      if (!latest) return;
      const want = reactionFor(latest);
      const have = latest.reaction ?? null;
      if (want === have) return;
      if (have) {
        if (!(await settled(this.#client.unreact(thread, thread.rootTs, have), 'no_reaction'))) return;
        await this.#recordReaction(card, have, null);
        continue;
      }
      if (!want || !(await settled(this.#client.react(thread, thread.rootTs, want), 'already_reacted'))) return;
      if (await this.#recordReaction(card, null, want)) continue;
      // Another writer moved the reaction first: take back ours unless it is the one it recorded.
      const now = await this.#current(card);
      if (want !== (now?.reaction ?? null)) {
        await this.#client.unreact(thread, thread.rootTs, want).catch(() => undefined);
      }
    }
  }

  /** Records the alert's reaction moving from `from` to `to`, unless another writer moved it first. */
  async #recordReaction(card: Card, from: string | null, to: string | null): Promise<boolean> {
    const recorded = await updateCardMetadata(
      this.#workItems,
      { orgId: card.orgId, id: card.id, userId: STATUS_USER_ID },
      current => {
        const status = readAlertSlackStatus(current);
        return status && (status.reaction ?? null) === from
          ? { [ALERT_SLACK_STATUS_KEY]: { ...status, reaction: to } }
          : null;
      },
    );
    return recorded !== null;
  }

  async #setMessage(
    card: Card,
    slot: AlertMessageSlot,
    update: (message: PostedMessage | undefined) => PostedMessage | undefined,
  ): Promise<void> {
    await updateCardMetadata(this.#workItems, { orgId: card.orgId, id: card.id, userId: STATUS_USER_ID }, current => {
      const status = readAlertSlackStatus(current);
      if (!status) return null;
      const before = status.messages[slot];
      const after = update(before);
      if (after === before) return null;
      const messages = { ...status.messages };
      if (after) messages[slot] = after;
      else delete messages[slot];
      return { [ALERT_SLACK_STATUS_KEY]: { ...status, messages } };
    });
  }
}

/**
 * `alert_post_update`: the triage run's way to talk in the alert's Slack thread. Each call posts
 * (or corrects) one reply and moves the status message, so the thread reads: looking → diagnosis → fix.
 */
export function buildAlertUpdateTool(input: {
  status: AlertSlackStatus;
  workItems: Pick<WorkItemsStorage, 'get'>;
  orgId: string;
  factoryProjectId: string;
}) {
  return {
    alert_post_update: createTool({
      id: 'alert_post_update',
      description:
        "Post to the alert's Slack thread and update the Factory's status message there. " +
        "Use kind 'diagnosis' once you know the cause (before writing code), 'fix' once the pull request is open " +
        "(pass pullRequestUrl), or 'no_fix' when no code change from you is right. Calling a kind again edits " +
        'its earlier reply. Returns posted:false when the card has no linked Slack thread.',
      inputSchema: z.object({
        workItemId: z.string().min(1),
        kind: z.enum(['diagnosis', 'fix', 'no_fix']),
        markdown: z.string().min(1).max(3_500),
        pullRequestUrl: z.string().url().optional(),
      }),
      execute: async ({ workItemId, kind, markdown, pullRequestUrl }) => {
        const card = await input.workItems.get({ orgId: input.orgId, id: workItemId });
        if (!card || card.factoryProjectId !== input.factoryProjectId) {
          return { posted: false, reason: 'No such work item in this Factory project.' };
        }
        try {
          if (!(await input.status.reply(card, kind === 'diagnosis' ? 'diagnosis' : 'fix', markdown))) {
            return { posted: false, reason: 'This card has no linked Slack thread.' };
          }
          await input.status.concluded(
            card,
            kind === 'diagnosis' ? 'diagnosed' : kind === 'fix' ? 'fix_up' : 'no_fix',
            pullRequestUrl,
          );
        } catch (error) {
          return {
            posted: false,
            reason: `Slack refused the post: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
        return { posted: true };
      },
    }),
  };
}

/**
 * True when the run's work item is an alert card whose thread carries the Factory's status: that
 * status and the fix reply hold the PR link, so the generic "Pull request opened" line would only
 * repeat it. Read from the card, so every replica agrees.
 */
export function alertThreadOwnsPullRequestAnnouncements(card: Card | null): boolean {
  return !!card && !!alertSlackThreadOf(card) && !!readAlertSlackStatus(card)?.messages.status;
}
