import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createBoardRegistry } from '../../boards/index.js';
import { FactoryDecisionDispatcher } from '../../rules/dispatcher.js';
import { FactoryTransitionService } from '../../rules/transition-service.js';
import type { PlatformAlertEvent } from '../../rules/types.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { createAlertThreads } from './mention.js';
import { ALERT_STATE_KEY, ALERT_TIMELINE_KEY, findAlertCardForThread, PlatformAlertRules } from './rules.js';
import type { PlatformAlertRulesOptions } from './rules.js';
import { bindAlertRunThread, bindAlertRunsOnThreadLink } from './run-thread.js';
import type { AlertCardState, AlertTimelineEntry } from './state.js';

const T0 = Date.parse('2026-11-13T10:00:00Z');
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function alert(
  type: PlatformAlertEvent['type'],
  incidentId: string,
  severity: PlatformAlertEvent['incident']['severity'] = 'error',
  organizationId = 'org-1',
): PlatformAlertEvent {
  const suffix = {
    'alert.opened': 'opened',
    'alert.resolved': 'resolved',
    'alert.severity_raised': `sev:${severity}`,
    'alert.thread_linked': 'thread',
  }[type];
  return {
    eventId: `${incidentId}:${suffix}`,
    type,
    occurredAt: new Date(T0).toISOString(),
    organizationId,
    incident: {
      id: incidentId,
      fingerprint: 'fp-1',
      eventType: 'observability.rule',
      severity,
      openedAt: new Date(T0).toISOString(),
      resolvedAt: type === 'alert.resolved' ? new Date(T0).toISOString() : null,
      eventCount: 1,
    },
    workKey: { kind: 'rule', ruleId: 'rule-1' },
    projectId: 'platform-project-1',
    region: 'us',
    rule: {
      id: 'rule-1',
      name: 'Agent error rate',
      conditionSummary: 'error rate > 5% over 5m',
      windowSeconds: 300,
      url: '',
    },
    summary: 'Agent error rate above 5%',
  };
}

async function setup(options: Pick<PlatformAlertRulesOptions, 'onThreadAttached' | 'onRecovered' | 'rules'> = {}) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'acme/app' } });
  const boards = createBoardRegistry();
  let now = T0;
  const rules = new PlatformAlertRules({
    projects: seeded.projects,
    storage: seeded.workItems,
    configVersion: 'factory-config-v1',
    boards,
    now: () => new Date(now),
    ...options,
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
    ownerId: 'alert-rules-test',
  });
  const drain = () => dispatcher.runOnce(new Date(now + 60_000));
  // An opened incident opens when it is ingested; the polled-late case lives in state.test.ts.
  const ingest = (event: PlatformAlertEvent, at = now, extra: { createCards?: boolean } = {}) => {
    now = at;
    const fired =
      event.type === 'alert.opened'
        ? { ...event, incident: { ...event.incident, openedAt: new Date(at).toISOString() } }
        : event;
    return rules.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, event: fired, ...extra });
  };
  const cards = async () =>
    (await seeded.workItems.list({ orgId: 'org-1', factoryProjectId: project.id })).filter(
      card => card.externalSource?.integrationId === 'mastra-alerts',
    );
  const timeline = (card: { metadata: Record<string, unknown> | null }) =>
    ((card.metadata?.[ALERT_TIMELINE_KEY] ?? []) as AlertTimelineEntry[]).map(entry => entry.kind);
  const state = (card: { metadata: Record<string, unknown> | null }) =>
    card.metadata?.[ALERT_STATE_KEY] as AlertCardState;
  const runs = async () =>
    (await seeded.workItems.listDeferredDecisions('org-1', project.id)).filter(
      entry => entry.decision.type === 'invokeSkill',
    );
  return { seeded, project, ingest, drain, cards, timeline, state, runs };
}

describe('PlatformAlertRules', () => {
  it("attaches the alert's Slack thread so a mention there finds the card", async () => {
    const { seeded, ingest, drain, cards } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    await drain();
    const linked = { ...alert('alert.thread_linked', 'i1'), slack: { teamId: 'T1', channelId: 'C1', ts: '1700.1' } };
    expect(await ingest(linked, T0 + MIN)).toMatchObject({
      status: 'committed',
      bindThread: { teamId: 'T1', channelId: 'C1', ts: '1700.1' },
    });
    const [card] = await cards();
    const found = await findAlertCardForThread(seeded.workItems, { teamId: 'T1', threadId: 'slack:C1:1700.1' });
    expect(found?.id).toBe(card!.id);
    expect(await findAlertCardForThread(seeded.workItems, { teamId: 'T2', threadId: 'slack:C1:1700.1' })).toBeNull();
    expect(await ingest({ ...linked, eventId: 'i1:thread:again' }, T0 + 2 * MIN)).toMatchObject({
      status: 'committed',
    });
  });

  it('files a first fire on Work › Intake with alert labels, then holds until the card exists', async () => {
    const { ingest, drain, cards, timeline } = await setup();
    await expect(ingest(alert('alert.opened', 'i1'))).resolves.toEqual({ status: 'pending' });
    await expect(ingest(alert('alert.opened', 'i1'))).resolves.toEqual({ status: 'pending' });
    await drain();
    const [card, ...rest] = await cards();
    expect(rest).toHaveLength(0);
    expect(card).toMatchObject({
      board: 'work',
      stages: ['intake'],
      title: 'Alert: Agent error rate',
      externalSource: { integrationId: 'mastra-alerts', type: 'alert', externalId: 'rule:rule-1#1' },
      workItem: { labels: ['alert', 'severity:error', 'rule:Agent error rate'] },
    });
    expect(timeline(card!)).toEqual(['fired']);
    await expect(ingest(alert('alert.opened', 'i1'))).resolves.toEqual({
      status: 'replayed',
      card: { workItemId: card!.id, board: 'work' },
    });
  });

  it('plans again when the alert state moves before its commit', async () => {
    const { seeded, ingest, drain, cards, timeline } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    await drain();
    const commit = seeded.workItems.commitRuleEvaluation.bind(seeded.workItems);
    let raced = false;
    // Another event's state lands between this event's plan and its commit.
    seeded.workItems.commitRuleEvaluation = async input => {
      if (!raced) {
        raced = true;
        await ingest(alert('alert.opened', 'i2'), T0 + 30 * MIN);
      }
      return commit(input);
    };
    await ingest(alert('alert.resolved', 'i1'), T0 + 31 * MIN);
    seeded.workItems.commitRuleEvaluation = commit;
    expect(timeline((await cards())[0]!)).toEqual(['fired', 'fired_again', 'recovered']);
  });

  it('records a below-floor fire as rejected and files nothing', async () => {
    const { ingest, drain, cards } = await setup();
    await expect(ingest(alert('alert.opened', 'i1', 'warning'))).resolves.toEqual({
      status: 'rejected',
      code: 'below_severity_floor',
    });
    await drain();
    expect(await cards()).toHaveLength(0);
  });

  it("ignores another organization's alert", async () => {
    const { ingest } = await setup();
    await expect(ingest(alert('alert.opened', 'i1', 'error', 'org-2'))).resolves.toEqual({ status: 'missing' });
  });

  it('keeps recoveries and re-fires on the same card without starting runs', async () => {
    const { ingest, drain, cards, timeline, state, runs } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    await drain();
    await ingest(alert('alert.resolved', 'i1'), T0 + MIN);
    const refired = await ingest(alert('alert.opened', 'i2'), T0 + 30 * MIN);
    expect(refired).toMatchObject({ status: 'committed', created: false, reopened: false });
    await expect(ingest(alert('alert.opened', 'i2'), T0 + 31 * MIN)).resolves.toMatchObject({ status: 'replayed' });
    await drain();
    const [card, ...rest] = await cards();
    expect(rest).toHaveLength(0);
    expect(timeline(card!)).toEqual(['fired', 'recovered', 'fired_again']);
    expect(state(card!).fireCount).toBe(2);
    expect(card!.stages).toEqual(['intake']);
    expect(await runs()).toHaveLength(0);
  });

  it('reopens a finished card within the cooldown and files a linked card after it', async () => {
    // Moving a card to Done stamps the wall clock; pin it so the cooldown is measured from T0.
    vi.useFakeTimers({ toFake: ['Date'], now: T0 + MIN });
    onTestFinished(() => vi.useRealTimers());
    const { seeded, ingest, drain, cards, timeline, state } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    await drain();
    const [first] = await cards();
    await seeded.workItems.update({ orgId: 'org-1', id: first!.id, userId: 'user-1', patch: { stages: ['done'] } });

    await expect(ingest(alert('alert.opened', 'i2'), T0 + 2 * DAY)).resolves.toMatchObject({
      status: 'committed',
      workItemId: first!.id,
      reopened: true,
    });
    await drain();
    const reopened = (await cards()).find(card => card.id === first!.id)!;
    expect(reopened.stages).toEqual(['intake']);
    expect(timeline(reopened).at(-1)).toBe('reopened');

    vi.setSystemTime(T0 + 3 * DAY);
    await seeded.workItems.update({ orgId: 'org-1', id: first!.id, userId: 'user-1', patch: { stages: ['done'] } });
    await expect(ingest(alert('alert.opened', 'i3'), T0 + 12 * DAY)).resolves.toEqual({ status: 'pending' });
    await drain();
    const all = await cards();
    expect(all).toHaveLength(2);
    const second = all.find(card => card.id !== first!.id)!;
    expect(second.externalSource?.externalId).toBe('rule:rule-1#2');
    expect(state(second)).toMatchObject({ generation: 2, previousCardId: first!.id });
  });

  it('records a severity raise on the card and its labels', async () => {
    const { ingest, drain, cards, timeline } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    await drain();
    await ingest(alert('alert.severity_raised', 'i1', 'critical'), T0 + MIN);
    const [card] = await cards();
    expect(timeline(card!)).toEqual(['fired', 'severity_raised']);
    expect(card!.workItem.labels).toContain('severity:critical');
  });

  it("files no card for a raise the project's binding doesn't take, but still updates its own card", async () => {
    const { ingest, drain, cards, timeline } = await setup();
    const keep = { createCards: false };
    await expect(ingest(alert('alert.severity_raised', 'i1', 'critical'), T0, keep)).resolves.toEqual({
      status: 'missing',
    });
    await drain();
    expect(await cards()).toHaveLength(0);

    await ingest(alert('alert.opened', 'i2'), T0 + MIN);
    await drain();
    await expect(ingest(alert('alert.severity_raised', 'i2', 'critical'), T0 + 2 * MIN, keep)).resolves.toMatchObject({
      status: 'committed',
      created: false,
    });
    const [card, ...rest] = await cards();
    expect(rest).toHaveLength(0);
    expect(timeline(card!)).toEqual(['fired', 'severity_raised']);
  });

  it('settles on recovered when the resolve arrives before its opened', async () => {
    const { ingest, drain, cards, timeline, state } = await setup();
    await expect(ingest(alert('alert.resolved', 'i1'))).resolves.toEqual({ status: 'remembered' });
    await ingest(alert('alert.opened', 'i1'), T0 + MIN);
    await drain();
    const [card] = await cards();
    expect(timeline(card!)).toEqual(['fired', 'recovered']);
    expect(state(card!).incidents.i1?.resolvedAt).not.toBeNull();
  });

  it("links the card's run thread to the alert's Slack thread once the thread is known", async () => {
    const { ingest, drain, cards } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    await drain();
    const setSettingOn = vi.fn(async () => undefined);
    const thread = { setSettingOn };
    const binding = { threadId: 'run-thread-1', sessionId: 'session-1' };
    expect(await bindAlertRunThread({ item: (await cards())[0]!, binding, thread })).toBe(false);

    await ingest(
      { ...alert('alert.thread_linked', 'i1'), slack: { teamId: 'T1', channelId: 'C1', ts: '1700.1' } },
      T0 + MIN,
    );
    expect(await bindAlertRunThread({ item: (await cards())[0]!, binding, thread })).toBe(true);
    expect(Object.fromEntries(setSettingOn.mock.calls.map(([call]) => [call.key, call.value]))).toEqual({
      channel_platform: 'slack',
      channel_externalThreadId: 'slack:C1:1700.1',
      channel_externalChannelId: 'C1',
      factorySessionId: 'session-1',
    });
    expect(setSettingOn.mock.calls.every(([call]) => call.threadId === 'run-thread-1')).toBe(true);
  });

  it('binds a run that started before the thread was known when thread_linked arrives', async () => {
    const stamps: Record<string, Record<string, unknown>> = {};
    let workItems: Awaited<ReturnType<typeof setup>>['seeded']['workItems'] | undefined;
    const { seeded, project, ingest, drain, cards, runs } = await setup({
      onThreadAttached: async card => {
        await bindAlertRunsOnThreadLink({
          card,
          listRunBindings: (orgId, factoryProjectId, workItemId) =>
            workItems!.listRunBindings(orgId, factoryProjectId, workItemId),
          getSession: async sessionId => ({
            thread: {
              setSettingOn: async ({ threadId, key, value }) => {
                (stamps[`${sessionId}/${threadId}`] ??= {})[key] = value;
              },
            },
          }),
        });
      },
    });
    workItems = seeded.workItems;
    await ingest(alert('alert.opened', 'i1'));
    await drain();
    const [card] = await cards();
    const started = (session: string) =>
      seeded.workItems.prepareRunStart({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: project.id,
        workItem: { id: card!.id, input: { title: card!.title, stages: ['execute'], sessions: {}, metadata: {} } },
        role: session,
        session: { sessionId: `session-${session}`, branch: `factory/${session}`, threadId: `thread-${session}` },
        resourceId: 'resource-1',
        kickoffKey: `kickoff-${session}`,
        kickoffMessage: null,
      });
    await started('work');
    const revoked = await started('review');
    await seeded.workItems.revokeRunBinding({
      orgId: 'org-1',
      factoryProjectId: project.id,
      bindingId: revoked.binding.id,
      revokedAt: new Date(T0),
    });
    const runsBefore = (await runs()).length;

    await ingest(
      { ...alert('alert.thread_linked', 'i1'), slack: { teamId: 'T1', channelId: 'C1', ts: '1700.1' } },
      T0 + MIN,
    );

    expect(stamps).toEqual({
      'session-work/thread-work': {
        channel_platform: 'slack',
        channel_externalThreadId: 'slack:C1:1700.1',
        channel_externalChannelId: 'C1',
        factorySessionId: 'session-work',
      },
    });
    expect((await runs()).length).toBe(runsBefore);
  });

  it('records a mention in the alert thread on the card and briefs the session', async () => {
    const { seeded, ingest, drain, cards, timeline } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    await drain();
    await ingest(
      { ...alert('alert.thread_linked', 'i1'), slack: { teamId: 'T1', channelId: 'C1', ts: '1700.1' } },
      T0 + MIN,
    );
    const threads = createAlertThreads(seeded.workItems);
    const found = await threads.find({ teamId: 'T1', threadId: 'slack:C1:1700.1' });
    expect(found?.preamble).toContain('Incident ids: i1');
    await threads.recordMention(found!, { author: 'daniel', text: 'is this the deploy?', at: new Date(T0 + 2 * MIN) });
    const [card] = await cards();
    expect(timeline(card!)).toEqual(['fired', 'mention']);
  });

  it('keeps both initial fires that raced to file the card', async () => {
    const { ingest, drain, cards, state, timeline } = await setup();
    await expect(ingest(alert('alert.opened', 'i1'))).resolves.toEqual({ status: 'pending' });
    await expect(ingest(alert('alert.opened', 'i2'), T0 + MIN)).resolves.toEqual({ status: 'pending' });
    await drain();
    await expect(ingest(alert('alert.opened', 'i1'), T0 + 2 * MIN)).resolves.toMatchObject({ status: 'replayed' });
    await expect(ingest(alert('alert.opened', 'i2'), T0 + 2 * MIN)).resolves.toMatchObject({
      status: 'committed',
      created: false,
    });
    await expect(ingest(alert('alert.opened', 'i2'), T0 + 3 * MIN)).resolves.toMatchObject({ status: 'replayed' });
    const [card, ...rest] = await cards();
    expect(rest).toHaveLength(0);
    expect(state(card!)).toMatchObject({ fireCount: 2 });
    expect(Object.keys(state(card!).incidents).sort()).toEqual(['i1', 'i2']);
    expect(timeline(card!)).toEqual(['fired', 'flapping']);
  });

  it("attaches a first fire's Slack thread once its card is filed", async () => {
    const onThreadAttached = vi.fn(async () => {});
    const { seeded, ingest, drain, cards } = await setup({ onThreadAttached });
    const opened = { ...alert('alert.opened', 'i1'), slack: { teamId: 'T1', channelId: 'C1', ts: '1700.1' } };
    await expect(ingest(opened)).resolves.toEqual({ status: 'pending' });
    await drain();
    await expect(ingest(opened, T0 + MIN)).resolves.toMatchObject({ status: 'replayed' });
    const [card] = await cards();
    const found = await findAlertCardForThread(seeded.workItems, { teamId: 'T1', threadId: 'slack:C1:1700.1' });
    expect(found?.id).toBe(card!.id);
    expect(onThreadAttached).toHaveBeenCalledTimes(1);
  });

  it('attaches the Slack thread on a redelivery after the attach failed', async () => {
    const { seeded, ingest, drain } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    await drain();
    vi.spyOn(seeded.workItems, 'attachSource').mockRejectedValueOnce(new Error('database went away'));
    const linked = { ...alert('alert.thread_linked', 'i1'), slack: { teamId: 'T1', channelId: 'C1', ts: '1700.1' } };
    await expect(ingest(linked, T0 + MIN)).rejects.toThrow('database went away');
    expect(await findAlertCardForThread(seeded.workItems, { teamId: 'T1', threadId: 'slack:C1:1700.1' })).toBeNull();
    await expect(ingest(linked, T0 + 2 * MIN)).resolves.toMatchObject({ status: 'replayed' });
    expect(await findAlertCardForThread(seeded.workItems, { teamId: 'T1', threadId: 'slack:C1:1700.1' })).not.toBeNull();
  });

  it('lands a late resolve on the card that filed its incident, not the newer one', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: T0 + MIN });
    onTestFinished(() => vi.useRealTimers());
    const { seeded, ingest, drain, cards, timeline } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    await drain();
    const [first] = await cards();
    await seeded.workItems.update({ orgId: 'org-1', id: first!.id, userId: 'user-1', patch: { stages: ['done'] } });
    await ingest(alert('alert.opened', 'i2'), T0 + 12 * DAY);
    await drain();

    await expect(ingest(alert('alert.resolved', 'i1'), T0 + 12 * DAY + MIN)).resolves.toMatchObject({
      status: 'committed',
      workItemId: first!.id,
    });
    const all = await cards();
    const second = all.find(card => card.id !== first!.id)!;
    expect(timeline(all.find(card => card.id === first!.id)!)).toEqual(['fired', 'recovered']);
    expect(timeline(second)).toEqual(['fired']);
  });

  it("doesn't hold the event when the rules accept a first fire but file no card", async () => {
    const { ingest, drain, cards } = await setup({ rules: { alertOpened: () => undefined } });
    await expect(ingest(alert('alert.opened', 'i1'))).resolves.toEqual({ status: 'rejected', code: 'not_filed' });
    await drain();
    await expect(ingest(alert('alert.opened', 'i1'))).resolves.toEqual({ status: 'rejected', code: 'not_filed' });
    expect(await cards()).toHaveLength(0);
  });

  it('reports a recovery only for the event that records it, and survives a hook that throws', async () => {
    const onRecovered = vi.fn((): Promise<void> => {
      throw new Error('slack down');
    });
    const { ingest, drain } = await setup({ onRecovered });
    await ingest(alert('alert.opened', 'i1'));
    await drain();
    await expect(ingest(alert('alert.resolved', 'i1'), T0 + MIN)).resolves.toMatchObject({ status: 'committed' });
    await expect(ingest(alert('alert.resolved', 'i2'), T0 + 2 * MIN)).resolves.toMatchObject({ status: 'committed' });
    expect(onRecovered).toHaveBeenCalledTimes(1);
  });

  it('keeps a resolve an older card remembered when the incident opens after a rollover', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: T0 + MIN });
    onTestFinished(() => vi.useRealTimers());
    const { seeded, ingest, drain, cards, state } = await setup();
    await ingest(alert('alert.opened', 'i1'));
    await drain();
    const [first] = await cards();
    await seeded.workItems.update({ orgId: 'org-1', id: first!.id, userId: 'user-1', patch: { stages: ['done'] } });
    await ingest(alert('alert.resolved', 'b'), T0 + 2 * DAY);
    await ingest(alert('alert.opened', 'c'), T0 + 12 * DAY);
    await drain();
    await ingest(alert('alert.opened', 'b'), T0 + 12 * DAY + MIN);
    const second = (await cards()).find(card => card.id !== first!.id)!;
    expect(state(second)).toMatchObject({ fireCount: 2 });
    expect(state(second).incidents.b?.resolvedAt).toBe(new Date(T0).toISOString());
  });

  it('keeps a recovery that arrived before its open when its first fire merges into another card', async () => {
    const { ingest, drain, cards, state } = await setup();
    await expect(ingest(alert('alert.resolved', 'b'))).resolves.toEqual({ status: 'remembered' });
    await expect(ingest(alert('alert.opened', 'a'), T0 + MIN)).resolves.toEqual({ status: 'pending' });
    await expect(ingest(alert('alert.opened', 'b'), T0 + 2 * MIN)).resolves.toEqual({ status: 'pending' });
    await drain();
    await ingest(alert('alert.opened', 'a'), T0 + 3 * MIN);
    await ingest(alert('alert.opened', 'b'), T0 + 3 * MIN);
    const [card, ...rest] = await cards();
    expect(rest).toHaveLength(0);
    expect(state(card!).incidents.b?.resolvedAt).toBe(new Date(T0).toISOString());
  });
});
