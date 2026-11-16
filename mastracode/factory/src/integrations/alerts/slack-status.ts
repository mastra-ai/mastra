import { createTool } from '@mastra/core/tools';
import type { Chat } from 'chat';
import { z } from 'zod';

import { factoryWorkItemUrl } from '../../links.js';
import type { Card, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { FactoryRunOutcome } from '../../tools/reports.js';
import { updateCardMetadata } from './card-metadata.js';
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
 */
interface PostedMessage {
  ts?: string;
  claimedAt: string;
}

export interface AlertSlackStatusRecord {
  stage: AlertTriageStage;
  pullRequestUrl?: string;
  reason?: string;
  recoveredAt?: string;
  messages: Partial<Record<AlertMessageSlot, PostedMessage>>;
}

const CLAIM_STALE_MS = 2 * 60_000;
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
    const recoveredAt = `${at.toISOString().slice(11, 16)} UTC`;
    return this.#writeStatus(card, previous => (previous ? { recoveredAt } : null));
  }

  /** The diagnosis or fix reply. A second call edits the first reply instead of posting another. */
  async reply(card: Card, slot: 'diagnosis' | 'fix', markdown: string): Promise<boolean> {
    return this.#write(
      card,
      slot,
      () => ({}),
      () => markdown,
    );
  }

  #writeStatus(card: Card, change: StatusChange): Promise<boolean> {
    return this.#write(card, 'status', change, status => alertStatusText(status, this.#cardUrl(card)));
  }

  async #write(
    card: Card,
    slot: AlertMessageSlot,
    change: StatusChange,
    render: (status: AlertSlackStatusRecord) => string,
  ): Promise<boolean> {
    const thread = threadOf(card);
    if (!thread) return false;
    let claimed = false;
    const now = this.#now();
    const written = await updateCardMetadata(
      this.#workItems,
      { orgId: card.orgId, id: card.id, userId: STATUS_USER_ID },
      current => {
        claimed = false;
        const previous = readAlertSlackStatus(current);
        const changed = change(previous);
        if (!changed) return null;
        const next: AlertSlackStatusRecord = {
          ...(previous ?? { stage: 'filed' }),
          ...changed,
          messages: { ...previous?.messages },
        };
        const message = next.messages[slot];
        if (!message?.ts && (!message || now.getTime() - Date.parse(message.claimedAt) > CLAIM_STALE_MS)) {
          claimed = true;
          next.messages[slot] = { claimedAt: now.toISOString() };
        }
        return { [ALERT_SLACK_STATUS_KEY]: next };
      },
    );
    if (!written) return false;
    const before = readAlertSlackStatus(written.before);
    let after = readAlertSlackStatus(written.after)!;
    if (claimed) {
      let ts: string;
      try {
        ts = await this.#client.post(thread, render(after));
      } catch (error) {
        await this.#setMessage(card, slot, undefined).catch(() => undefined);
        throw error;
      }
      const latest = (await this.#setMessage(card, slot, { ts, claimedAt: now.toISOString() })) ?? after;
      // Another write landed while the post was in flight and found no ts to edit: show it now.
      if (render(latest) !== render(after)) await this.#client.edit(thread, ts, render(latest));
      after = latest;
    } else {
      const ts = after.messages[slot]?.ts;
      // No ts: the claim holder is still posting, and shows the latest state once it has.
      if (ts) await this.#client.edit(thread, ts, render(after));
    }
    if (slot === 'status') await this.#swapReaction(thread, reactionFor(before), reactionFor(after));
    return true;
  }

  async #setMessage(
    card: Card,
    slot: AlertMessageSlot,
    message: PostedMessage | undefined,
  ): Promise<AlertSlackStatusRecord | null> {
    const written = await updateCardMetadata(
      this.#workItems,
      { orgId: card.orgId, id: card.id, userId: STATUS_USER_ID },
      current => {
        const status = readAlertSlackStatus(current);
        if (!status) return null;
        const messages = { ...status.messages };
        if (message) messages[slot] = message;
        else delete messages[slot];
        return { [ALERT_SLACK_STATUS_KEY]: { ...status, messages } };
      },
    );
    return written && readAlertSlackStatus(written.after);
  }

  async #swapReaction(thread: AlertThreadRef, before: string | null, after: string | null): Promise<void> {
    if (before === after) return;
    if (before) await this.#client.unreact(thread, thread.rootTs, before).catch(() => undefined);
    if (after) await this.#client.react(thread, thread.rootTs, after).catch(() => undefined);
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
