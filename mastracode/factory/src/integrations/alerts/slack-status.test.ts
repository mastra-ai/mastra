import { describe, expect, it } from 'vitest';
import { createBoardRegistry } from '../../boards/index.js';
import { FactoryDecisionDispatcher } from '../../rules/dispatcher.js';
import { FactoryTransitionService } from '../../rules/transition-service.js';
import type { PlatformAlertEvent } from '../../rules/types.js';
import type { FactoryRunBindingRecord } from '../../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { createAlertThreads } from './mention.js';
import { ALERT_TIMELINE_KEY, PlatformAlertRules } from './rules.js';
import {
  ALERT_SLACK_STATUS_KEY,
  AlertSlackStatus,
  alertThreadOwnsPullRequestAnnouncements,
  buildAlertUpdateTool,
} from './slack-status.js';
import type { AlertSlackClient, AlertSlackStatusRecord } from './slack-status.js';

const T0 = Date.parse('2026-11-16T17:00:00Z');
const MIN = 60_000;

function alert(type: PlatformAlertEvent['type'], incidentId: string, at = T0): PlatformAlertEvent {
  const suffix = { 'alert.opened': 'opened', 'alert.resolved': 'resolved', 'alert.thread_linked': 'thread' }[
    type as 'alert.opened'
  ];
  return {
    eventId: `${incidentId}:${suffix}`,
    type,
    occurredAt: new Date(at).toISOString(),
    organizationId: 'org-1',
    incident: {
      id: incidentId,
      fingerprint: 'fp-1',
      eventType: 'observability.rule',
      severity: 'error',
      openedAt: new Date(at).toISOString(),
      resolvedAt: type === 'alert.resolved' ? new Date(at).toISOString() : null,
      eventCount: 1,
    },
    workKey: { kind: 'rule', ruleId: 'rule-1' },
    projectId: 'platform-project-1',
    region: 'us',
    rule: { id: 'rule-1', name: 'Agent error rate', conditionSummary: 'rate > 5%', windowSeconds: 300, url: '' },
    summary: 'Agent error rate above 5%',
    ...(type === 'alert.thread_linked' ? { slack: { teamId: 'T1', channelId: 'C1', ts: '1700.1' } } : {}),
  };
}

function recordingClient() {
  const calls: Array<{ call: string; ts?: string; text?: string; emoji?: string }> = [];
  const slack: {
    covered: boolean;
    failPosts: number;
    failEdits: number;
    failReacts: number;
    failUnreacts: number;
    /** Holds a post or edit in flight until the returned promise settles; it lands after that. */
    hold?: (call: 'post' | 'edit' | 'react' | 'unreact', text: string) => Promise<void> | undefined;
  } = { covered: true, failPosts: 0, failEdits: 0, failReacts: 0, failUnreacts: 0 };
  let next = 0;
  const client: AlertSlackClient = {
    covers: async () => slack.covered,
    post: async (_thread, markdown) => {
      if (slack.failPosts > 0) {
        slack.failPosts--;
        throw new Error('ratelimited');
      }
      const ts = `1700.${++next + 100}`;
      await slack.hold?.('post', markdown);
      calls.push({ call: 'post', ts, text: markdown });
      return ts;
    },
    edit: async (_thread, ts, markdown) => {
      if (slack.failEdits > 0) {
        slack.failEdits--;
        throw new Error('ratelimited');
      }
      await slack.hold?.('edit', markdown);
      calls.push({ call: 'edit', ts, text: markdown });
    },
    react: async (_thread, ts, emoji) => {
      if (slack.failReacts > 0) {
        slack.failReacts--;
        throw new Error('ratelimited');
      }
      await slack.hold?.('react', emoji);
      calls.push({ call: 'react', ts, emoji });
    },
    unreact: async (_thread, ts, emoji) => {
      if (slack.failUnreacts > 0) {
        slack.failUnreacts--;
        throw new Error('ratelimited');
      }
      await slack.hold?.('unreact', emoji);
      calls.push({ call: 'unreact', ts, emoji });
    },
  };
  return { client, calls, slack };
}

async function setup() {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'acme/app' } });
  const boards = createBoardRegistry();
  const { client, calls, slack } = recordingClient();
  let now = T0;
  const status = new AlertSlackStatus({
    client,
    workItems: seeded.workItems,
    cardUrl: card => `https://f/${card.id}`,
    now: () => new Date(now),
  });
  const rules = new PlatformAlertRules({
    projects: seeded.projects,
    storage: seeded.workItems,
    configVersion: 'factory-config-v1',
    boards,
    now: () => new Date(now),
    onThreadAttached: async card => void (await status.linked(card)),
    onRecovered: async (card, at) => void (await status.recovered(card, at)),
  });
  const dispatcher = new FactoryDecisionDispatcher({
    controller: {} as never,
    storage: seeded.workItems,
    boards,
    transitionService: new FactoryTransitionService({
      storage: seeded.workItems,
      boards,
      configVersion: 'factory-config-v1',
    }),
    intakeRoutes: seeded.boards,
    ownerId: 'alert-status-test',
  });
  const ingest = async (event: PlatformAlertEvent, at = now) => {
    now = at;
    await rules.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, event });
    await dispatcher.runOnce(new Date(now + MIN));
  };
  const card = async () =>
    (await seeded.workItems.list({ orgId: 'org-1', factoryProjectId: project.id })).find(
      item => item.externalSource?.integrationId === 'mastra-alerts',
    )!;
  const record = async () => (await card()).metadata?.[ALERT_SLACK_STATUS_KEY] as AlertSlackStatusRecord | undefined;
  /** The card the calling session's run is bound to; the alert card unless a test says otherwise. */
  const session: { boundTo?: string | null } = {};
  const tool = buildAlertUpdateTool({
    status,
    workItems: {
      get: input => seeded.workItems.get(input),
      findActiveRunBindingForSession: async () => {
        const workItemId = session.boundTo === undefined ? (await card()).id : session.boundTo;
        return workItemId ? ({ workItemId } as FactoryRunBindingRecord) : null;
      },
    },
    orgId: 'org-1',
    factoryProjectId: project.id,
    sessionId: 'session-1',
  }).alert_post_update;
  const post = (input: {
    workItemId: string;
    kind: 'diagnosis' | 'fix' | 'no_fix';
    markdown: string;
    pullRequestUrl?: string;
  }) => tool.execute!(input, {} as never) as Promise<{ posted: boolean }>;
  const linked = async () => {
    await ingest(alert('alert.opened', 'i1'));
    await ingest(alert('alert.thread_linked', 'i1'), T0 + MIN);
    return card();
  };
  const setNow = (at: number) => {
    now = at;
  };
  return { seeded, project, ingest, card, record, calls, slack, status, post, linked, setNow, session };
}

describe('AlertSlackStatus', () => {
  it('posts one "filed" status with the card link when the thread is linked, however often it is linked', async () => {
    const { ingest, record, calls, card } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    expect(calls).toEqual([]);
    expect(alertThreadOwnsPullRequestAnnouncements(await card())).toBe(false);
    await ingest(alert('alert.thread_linked', 'i1'), T0 + MIN);
    await ingest({ ...alert('alert.thread_linked', 'i1'), eventId: 'i1:thread:again' }, T0 + 2 * MIN);

    expect(calls.map(call => call.call)).toEqual(['post']);
    expect(calls[0]!.text).toContain('Filed in the Factory');
    expect(calls[0]!.text).toContain('[Factory card](https://f/');
    expect(await record()).toMatchObject({ stage: 'filed', messages: { status: { ts: calls[0]!.ts } } });
    expect(alertThreadOwnsPullRequestAnnouncements(await card())).toBe(true);
  });

  it("leaves the thread to Platform when the Factory's Slack app can't post there", async () => {
    const { ingest, record, calls, slack, status, card } = await setup();
    slack.covered = false;
    await ingest(alert('alert.opened', 'i1'));
    await ingest(alert('alert.thread_linked', 'i1'), T0 + MIN);
    expect(await status.runStarted(await card())).toBe(false);
    expect(calls).toEqual([]);
    expect(await record()).toBeUndefined();
    expect(alertThreadOwnsPullRequestAnnouncements(await card())).toBe(false);
  });

  it('reads filed → looking → diagnosis → fix: one reply each, the status edited in place, the reaction swapped', async () => {
    const { linked, card, record, calls, status, post, ingest } = await setup();
    const statusTs = (await linked(), (await record())!.messages.status!.ts);
    calls.length = 0;

    await status.runStarted(await card());
    expect(calls).toEqual([
      expect.objectContaining({ call: 'edit', ts: statusTs, text: expect.stringContaining('looking into this alert') }),
      { call: 'react', ts: '1700.1', emoji: 'eyes' },
    ]);

    calls.length = 0;
    const workItemId = (await card()).id;
    expect(await post({ workItemId, kind: 'diagnosis', markdown: '*Why:* stale query param' })).toEqual({
      posted: true,
    });
    expect(calls.map(call => call.call)).toEqual(['post', 'edit']);
    expect(calls[1]).toMatchObject({ ts: statusTs, text: expect.stringContaining('Cause found') });

    calls.length = 0;
    const pr = 'https://github.com/acme/app/pull/1';
    expect(await post({ workItemId, kind: 'fix', markdown: 'Fix up', pullRequestUrl: pr })).toEqual({ posted: true });
    expect(calls.map(call => call.call)).toEqual(['post', 'edit', 'unreact', 'react']);
    expect(calls[1]!.text).toContain(`Fix is up for review*: ${pr}`);
    expect(calls.slice(2)).toEqual([
      { call: 'unreact', ts: '1700.1', emoji: 'eyes' },
      { call: 'react', ts: '1700.1', emoji: 'hammer_and_wrench' },
    ]);
    expect(await record()).toMatchObject({ stage: 'fix_up', pullRequestUrl: pr });

    // The run ending after its fix leaves the status alone; ✅ only once the alert itself recovers.
    calls.length = 0;
    expect(await status.runEnded(await card(), { status: 'done' })).toBe(false);
    await ingest(alert('alert.resolved', 'i1', T0 + 10 * MIN), T0 + 10 * MIN);
    expect(calls.map(call => call.call)).toEqual(['edit', 'unreact', 'react']);
    expect(calls[0]!.text).toContain('recovered at 17:10 UTC');
    expect(calls[2]).toMatchObject({ emoji: 'white_check_mark' });
  });

  it('edits its earlier reply when the run posts the same kind again', async () => {
    const { linked, card, calls, status, post } = await setup();
    const workItemId = (await linked()).id;
    await status.runStarted(await card());
    calls.length = 0;
    await post({ workItemId, kind: 'diagnosis', markdown: 'first take' });
    const replyTs = calls.find(call => call.call === 'post')!.ts;
    calls.length = 0;
    await post({ workItemId, kind: 'diagnosis', markdown: 'corrected' });
    expect(calls.filter(call => call.call === 'post')).toEqual([]);
    expect(calls).toContainEqual({ call: 'edit', ts: replyTs, text: 'corrected' });
  });

  it('posts once when replicas link the thread and start the run at the same time', async () => {
    const { ingest, card, calls, slack, status, record } = await setup();
    slack.covered = false;
    await ingest(alert('alert.opened', 'i1'));
    await ingest(alert('alert.thread_linked', 'i1'), T0 + MIN);
    slack.covered = true;
    const item = await card();
    await Promise.all([status.linked(item), status.linked(item), status.runStarted(item), status.runStarted(item)]);
    expect(calls.filter(call => call.call === 'post')).toHaveLength(1);
    const final = await record();
    expect(final).toMatchObject({ stage: 'investigating', messages: { status: { ts: calls[0]!.ts } } });
    // Whichever write lost the race to the post, the message ends on the latest stage.
    expect(calls.filter(call => call.call !== 'react' && call.call !== 'unreact').at(-1)!.text).toContain(
      'looking into this alert',
    );
  });

  it('says a run that ended without concluding ended, and a failed one stopped, but never overrides a conclusion', async () => {
    const { linked, card, record, calls, status, post } = await setup();
    await linked();
    await status.runStarted(await card());
    calls.length = 0;
    expect(await status.runEnded(await card(), { status: 'blocked' })).toBe(false);
    await status.runEnded(await card(), { status: 'done' });
    expect(calls.map(call => call.call)).toEqual(['edit', 'unreact', 'react']);
    expect(calls[0]!.text).toContain('ended without a written conclusion');

    // A new run restarts it; that one fails.
    await status.runStarted(await card());
    calls.length = 0;
    await status.runEnded(await card(), { status: 'failed', reason: 'sandbox crashed' });
    expect(calls[0]!.text).toContain('Factory triage stopped:* sandbox crashed');
    expect(calls[2]).toMatchObject({ emoji: 'warning' });

    await status.runStarted(await card());
    await post({ workItemId: (await card()).id, kind: 'no_fix', markdown: 'Upstream outage' });
    calls.length = 0;
    expect(await status.runEnded(await card(), { status: 'failed', reason: 'late' })).toBe(false);
    expect(await status.runStarted(await card())).toBe(false);
    expect(calls).toEqual([]);
    expect(await record()).toMatchObject({ stage: 'no_fix' });
  });

  it('releases the claim when Slack refuses the post, so the next write posts', async () => {
    const { ingest, card, calls, slack, status, record } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    slack.failPosts = 1;
    await ingest(alert('alert.thread_linked', 'i1'), T0 + MIN);
    expect(calls).toEqual([]);
    expect((await record())?.messages.status).toBeUndefined();
    await status.runStarted(await card());
    expect(calls.map(call => call.call)).toEqual(['post', 'react']);
    expect(calls[0]!.text).toContain('looking into this alert');
  });

  it('posts a status whose post failed when the same stage is written again', async () => {
    const { ingest, card, calls, slack, status, record } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    slack.failPosts = 2;
    await ingest(alert('alert.thread_linked', 'i1'), T0 + MIN);
    await expect(status.runStarted(await card())).rejects.toThrow('ratelimited');
    expect(calls).toEqual([]);
    expect(await record()).toMatchObject({ stage: 'investigating' });
    // A run bound once the thread is linked reports the same start again.
    expect(await status.runStarted(await card())).toBe(false);
    expect(calls.map(call => call.call)).toEqual(['post', 'react']);
    expect(calls[0]!.text).toContain('looking into this alert');
    expect((await record())!.messages.status!.ts).toBe(calls[0]!.ts);
  });

  it('redoes a failed status edit on the next write, though the stage has not moved since', async () => {
    const { linked, card, calls, slack, status } = await setup();
    await linked();
    await status.runStarted(await card());
    slack.failEdits = 1;
    await expect(status.runEnded(await card(), { status: 'failed', reason: 'sandbox crashed' })).rejects.toThrow(
      'ratelimited',
    );
    calls.length = 0;
    await status.runEnded(await card(), { status: 'failed', reason: 'sandbox crashed' });
    expect(calls.filter(call => call.call === 'edit').map(call => call.text)).toEqual([
      expect.stringContaining('Factory triage stopped:* sandbox crashed'),
    ]);
    expect(calls).toContainEqual(expect.objectContaining({ call: 'react', emoji: 'warning' }));
  });

  it('redoes a refused reaction on the next identical write', async () => {
    const { linked, card, calls, slack, status } = await setup();
    await linked();
    slack.failReacts = 1;
    await status.runStarted(await card());
    expect(calls.filter(call => call.call.endsWith('react'))).toEqual([]);
    calls.length = 0;
    await status.runStarted(await card());
    expect(calls).toEqual([{ call: 'react', ts: '1700.1', emoji: 'eyes' }]);
  });

  it('redoes a refused reaction removal on the next identical write', async () => {
    const { linked, card, calls, slack, status } = await setup();
    await linked();
    await status.runStarted(await card());
    slack.failUnreacts = 1;
    await status.runEnded(await card(), { status: 'failed', reason: 'sandbox crashed' });
    expect(calls.filter(call => call.call.endsWith('react'))).toEqual([{ call: 'react', ts: '1700.1', emoji: 'eyes' }]);
    calls.length = 0;
    await status.runEnded(await card(), { status: 'failed', reason: 'sandbox crashed' });
    expect(calls).toEqual([
      { call: 'unreact', ts: '1700.1', emoji: 'eyes' },
      { call: 'react', ts: '1700.1', emoji: 'warning' },
    ]);
  });

  it('keeps the reaction a restarted run wants when an older cleanup takes it off', async () => {
    const { linked, card, calls, slack, status } = await setup();
    await linked();
    const gate = () => {
      let open!: () => void;
      let reached!: () => void;
      return { held: new Promise<void>(r => (open = r)), at: new Promise<void>(r => (reached = r)), open: () => open(), reach: () => reached() };
    };
    const lateAdd = gate();
    const lateCleanup = gate();
    let reacts = 0;
    let unreacts = 0;
    slack.hold = (call, emoji) => {
      if (call === 'react' && emoji === 'eyes' && ++reacts === 1) return lateAdd.reach(), lateAdd.held;
      if (call === 'unreact' && emoji === 'eyes' && ++unreacts === 1) return lateCleanup.reach(), lateCleanup.held;
      return undefined;
    };
    // The first run's 👀 lands after the run failed, so it takes it back...
    const first = status.runStarted(await card());
    await lateAdd.at;
    await status.runEnded(await card(), { status: 'failed', reason: 'sandbox crashed' });
    lateAdd.open();
    await lateCleanup.at;
    // ...while a restarted run puts 👀 on again; the old cleanup lands after it.
    await status.runStarted(await card());
    // Putting it straight back is refused too.
    slack.failReacts = 1;
    lateCleanup.open();
    await first;
    const reactions = () => {
      const on = new Set<string>();
      for (const call of calls) {
        if (call.call === 'react') on.add(call.emoji!);
        if (call.call === 'unreact') on.delete(call.emoji!);
      }
      return [...on].sort();
    };
    expect(reactions()).toEqual([]);
    // The next write, the same as the last, puts it back.
    await status.runStarted(await card());
    expect(reactions()).toEqual(['eyes']);
  });

  it('takes back a late reaction whose cleanup Slack refused, on a later write', async () => {
    const { linked, card, calls, slack, status } = await setup();
    await linked();
    let release!: () => void;
    let reached!: () => void;
    const held = new Promise<void>(resolve => (release = resolve));
    const atReact = new Promise<void>(resolve => (reached = resolve));
    let holding = true;
    slack.hold = (call, text) => {
      if (call !== 'react' || text !== 'eyes' || !holding) return undefined;
      holding = false;
      reached();
      return held;
    };
    const looking = status.runStarted(await card());
    await atReact;
    await status.runEnded(await card(), { status: 'failed', reason: 'sandbox crashed' });
    // The cleanup and the same call's retry both refused.
    slack.failUnreacts = 2;
    release();
    await looking;
    const reactions = () => {
      const on = new Set<string>();
      for (const call of calls) {
        if (call.call === 'react') on.add(call.emoji!);
        if (call.call === 'unreact') on.delete(call.emoji!);
      }
      return [...on].sort();
    };
    expect(reactions()).toEqual(['eyes', 'warning']);
    await status.runEnded(await card(), { status: 'failed', reason: 'sandbox crashed' });
    expect(reactions()).toEqual(['warning']);
  });

  it('ends on the conclusion when an older "looking" edit lands after it', async () => {
    const { linked, card, calls, slack, status, post } = await setup();
    const workItemId = (await linked()).id;
    let release!: () => void;
    const held = new Promise<void>(resolve => (release = resolve));
    let holding = true;
    slack.hold = (call, text) => {
      if (call !== 'edit' || !holding || !text.includes('looking into this alert')) return undefined;
      holding = false;
      return held;
    };
    const started = status.runStarted(await card());
    await new Promise(resolve => setTimeout(resolve, 20));
    await post({ workItemId, kind: 'no_fix', markdown: 'Upstream outage' });
    release();
    await started;

    const statusTs = (await card()).metadata?.[ALERT_SLACK_STATUS_KEY] as AlertSlackStatusRecord;
    const edits = calls.filter(call => call.call === 'edit' && call.ts === statusTs.messages.status!.ts);
    expect(edits.at(-1)!.text).toContain('no code fix from the Factory');
    const reactions = new Set<string>();
    for (const call of calls) {
      if (call.call === 'react') reactions.add(call.emoji!);
      if (call.call === 'unreact') reactions.delete(call.emoji!);
    }
    expect([...reactions]).toEqual(['information_source']);
  });

  it('shows a diagnosis corrected while its first post was still in flight', async () => {
    const { linked, card, calls, slack, status, post } = await setup();
    const workItemId = (await linked()).id;
    await status.runStarted(await card());
    calls.length = 0;
    let release!: () => void;
    const held = new Promise<void>(resolve => (release = resolve));
    slack.hold = (call, text) => (call === 'post' && text === 'first take' ? held : undefined);
    const first = post({ workItemId, kind: 'diagnosis', markdown: 'first take' });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(await post({ workItemId, kind: 'diagnosis', markdown: 'corrected' })).toEqual({ posted: true });
    release();
    expect(await first).toEqual({ posted: true });

    const replyTs = calls.find(call => call.call === 'post' && call.text === 'first take')!.ts;
    expect(calls.filter(call => call.ts === replyTs).at(-1)).toMatchObject({ call: 'edit', text: 'corrected' });
    expect(calls.filter(call => call.call === 'post')).toHaveLength(1);
  });

  it('shows a recovery that came before the thread was linked', async () => {
    const { ingest, calls, record } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    await ingest(alert('alert.resolved', 'i1', T0 + 5 * MIN), T0 + 5 * MIN);
    await ingest(alert('alert.thread_linked', 'i1', T0 + 6 * MIN), T0 + 6 * MIN);
    expect(calls.map(call => call.call)).toEqual(['post', 'react']);
    expect(calls[0]!.text).toContain('recovered at 17:05 UTC');
    expect(calls[1]).toMatchObject({ emoji: 'white_check_mark' });
    expect(await record()).toMatchObject({ stage: 'filed', recoveredAt: '17:05 UTC' });
  });

  it('keeps a mention and a status change that land on the card at the same time', async () => {
    const { linked, card, seeded, status, record } = await setup();
    await linked();
    const threads = createAlertThreads(seeded.workItems);
    const ref = (await threads.find({ teamId: 'T1', threadId: 'slack:C1:1700.1' }))!;
    await Promise.all([
      status.runStarted(await card()),
      threads.recordMention(ref, { author: 'dana', text: 'is this the deploy?', at: new Date(T0 + 2 * MIN) }),
    ]);
    const timeline = (await card()).metadata?.[ALERT_TIMELINE_KEY] as Array<{ kind: string }>;
    expect(timeline.map(entry => entry.kind)).toContain('mention');
    expect(await record()).toMatchObject({ stage: 'investigating' });
  });

  it('posts nothing for a card without a linked thread', async () => {
    const { ingest, card, calls, post, status } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    expect(await post({ workItemId: (await card()).id, kind: 'diagnosis', markdown: 'x' })).toMatchObject({
      posted: false,
    });
    expect(await status.runStarted(await card())).toBe(false);
    expect(calls).toEqual([]);
  });

  it("won't let a run post to or move another card's alert thread", async () => {
    const { linked, card, calls, record, post, session, status } = await setup();
    const a = await linked();
    await status.runStarted(a);
    const before = await record();
    calls.length = 0;
    session.boundTo = 'some-other-card';
    await expect(post({ workItemId: (await card()).id, kind: 'diagnosis', markdown: 'not mine' })).resolves.toEqual({
      posted: false,
      reason: 'Only the card this run is working on can be updated.',
    });
    session.boundTo = null;
    await expect(post({ workItemId: (await card()).id, kind: 'no_fix', markdown: 'unbound' })).resolves.toMatchObject({
      posted: false,
    });
    expect(calls).toEqual([]);
    expect(await record()).toEqual(before);
  });
});
