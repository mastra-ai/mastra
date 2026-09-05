import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createFactorySupervisorActionTools } from './action-tools.js';
import { computeFactoryHealth } from './health.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const SCOPE = { orgId: 'org-1', factoryProjectId: PROJECT_ID };
const NOW = new Date('2026-09-04T12:00:00.000Z');
const emptyHealthInputs = { items: [], decisions: [], bindings: [], pendingStarts: [] };

function execute<T>(tool: unknown, input: unknown): Promise<T> {
  return (tool as { execute: (input: unknown, ctx: unknown) => Promise<T> }).execute(input, {});
}

/** A controller with no reachable sessions; answer-tool tests build their own. */
const noSessions = { getSessionByResource: async () => undefined };

const finding = (key: string) => ({
  kind: 'decision-failed' as const,
  id: key,
  workItemId: null,
  workItemNumber: null,
  title: 'Issue 1',
  evidence: '[run_awaiting_input] failed after 1 attempt(s)',
  ageMs: 1_000,
  suggestedRepair: null,
});

async function setup(actor: { type: 'human' | 'agent'; id: string } = { type: 'agent', id: 'agent:thread-1' }) {
  const seed = await createFactoryStorageForTests();
  await seed.workItems.syncSupervisorFindings({ ...SCOPE, findings: [finding('decision-failed:d1')], now: NOW });
  const tools = createFactorySupervisorActionTools({
    scope: SCOPE,
    actor,
    workItems: seed.workItems,
    audit: seed.audit,
    controller: noSessions,
    now: () => NOW,
  });
  return { ...seed, tools };
}

async function openRow(workItems: Awaited<ReturnType<typeof setup>>['workItems'], key: string) {
  return (await workItems.listSupervisorFindingPage({ ...SCOPE, limit: 10 })).rows.find(row => row.findingKey === key);
}

describe('factory_escalate_finding', () => {
  it('is approval-free: escalating is how the supervisor reaches a person', async () => {
    const { tools } = await setup();
    expect((tools.factory_escalate_finding as { requireApproval?: boolean }).requireApproval).toBeFalsy();
  });

  it('escalates an open finding with the note and audits the actor the turn has', async () => {
    const { tools, workItems, audit } = await setup();

    const result = await execute<any>(tools.factory_escalate_finding, {
      findingKey: 'decision-failed:d1',
      note: 'Worker is asking which API version to target.',
    });

    expect(result).toEqual({
      findingKey: 'decision-failed:d1',
      status: 'escalated',
      escalatedAt: NOW.toISOString(),
      note: 'Worker is asking which API version to target.',
      audited: true,
    });
    const row = await openRow(workItems, 'decision-failed:d1');
    expect(row).toMatchObject({ status: 'escalated', escalationNote: 'Worker is asking which API version to target.' });
    expect(row?.escalatedAt?.getTime()).toBe(NOW.getTime());
    const event = (await audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID, limit: 5 })).events[0];
    expect(event).toMatchObject({
      action: 'factory.supervisor.finding_escalated',
      actorType: 'agent',
      actorId: 'agent:thread-1',
      targets: [{ type: 'supervisor_finding', id: 'decision-failed:d1' }],
      metadata: { cause: 'supervisor', note: 'Worker is asking which API version to target.' },
    });
  });

  it('reports an escalation that landed even when the audit write fails', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.workItems.syncSupervisorFindings({ ...SCOPE, findings: [finding('decision-failed:d1')], now: NOW });
    const warn = vi.fn();
    const tools = createFactorySupervisorActionTools({
      scope: SCOPE,
      actor: { type: 'agent', id: 'agent:thread-1' },
      workItems: seed.workItems,
      audit: {
        record: async () => {
          throw new Error('audit store down at postgres://secret');
        },
      },
      logger: { warn },
      controller: noSessions,
      now: () => NOW,
    });

    const result = await execute<any>(tools.factory_escalate_finding, { findingKey: 'decision-failed:d1', note: 'n' });

    // The row is escalated (the human-visible effect) and the result says the
    // audit did not land, so the supervisor neither retries nor believes it
    // failed. The raw storage error goes to the log, not the model.
    expect(result).toMatchObject({ status: 'escalated', audited: false, auditError: expect.any(String) });
    expect(result.auditError).not.toContain('postgres');
    expect(warn).toHaveBeenCalledWith(
      'Factory supervisor escalation audit failed',
      expect.objectContaining({ error: expect.stringContaining('postgres://secret') }),
    );
    expect(await openRow(seed.workItems, 'decision-failed:d1')).toMatchObject({ status: 'escalated' });
  });

  it('attributes to the human on an authenticated turn', async () => {
    const { tools, audit } = await setup({ type: 'human', id: 'user-7' });
    await execute(tools.factory_escalate_finding, { findingKey: 'decision-failed:d1', note: 'n' });
    const event = (await audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID, limit: 5 })).events[0];
    expect(event).toMatchObject({ actorType: 'human', actorId: 'user-7' });
  });

  it('rejects unknown and resolved findings without writing an audit row', async () => {
    const { tools, workItems, audit } = await setup();
    await expect(
      execute(tools.factory_escalate_finding, { findingKey: 'decision-failed:nope', note: 'n' }),
    ).rejects.toThrow(/not open/);
    await workItems.syncSupervisorFindings({ ...SCOPE, findings: [], now: new Date(NOW.getTime() + 1_000) });
    await expect(
      execute(tools.factory_escalate_finding, { findingKey: 'decision-failed:d1', note: 'n' }),
    ).rejects.toThrow(/not open/);
    expect((await audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID, limit: 5 })).events).toEqual([]);
  });

  it('is scoped to its own factory project', async () => {
    const seed = await createFactoryStorageForTests();
    const otherProject = '99999999-2222-4333-8444-555555555555';
    await seed.workItems.syncSupervisorFindings({
      orgId: 'org-1',
      factoryProjectId: otherProject,
      findings: [finding('decision-failed:elsewhere')],
      now: NOW,
    });
    const tools = createFactorySupervisorActionTools({
      scope: SCOPE,
      actor: { type: 'agent', id: 'agent:thread-1' },
      workItems: seed.workItems,
      audit: seed.audit,
      controller: noSessions,
      now: () => NOW,
    });
    await expect(
      execute(tools.factory_escalate_finding, { findingKey: 'decision-failed:elsewhere', note: 'n' }),
    ).rejects.toThrow(/not open/);
    const untouched = (
      await seed.workItems.listSupervisorFindingPage({ orgId: 'org-1', factoryProjectId: otherProject, limit: 5 })
    ).rows[0];
    expect(untouched?.status).toBe('open');
  });

  it('rejects an empty note', async () => {
    const { tools } = await setup();
    await expect(
      execute<{ error?: boolean }>(tools.factory_escalate_finding, { findingKey: 'decision-failed:d1', note: '  ' }),
    ).resolves.toMatchObject({ error: true });
  });
});

describe('factory_answer_suspension', () => {
  type Parked = {
    toolName?: string;
    options?: string[];
    selectionMode?: string;
    failureCode?: string;
    withSuspension?: boolean;
  };

  /** A real terminally failed decision parked on a question, its binding, and its finding row. */
  async function parkDecision(seed: Awaited<ReturnType<typeof createFactoryStorageForTests>>, parked: Parked = {}) {
    const { item } = await seed.workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: { title: 'Fix login', stages: ['execute'], sessions: {}, metadata: {} },
    });
    const { binding } = await seed.workItems.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: { id: item.id, input: { title: 'Fix login', stages: ['execute'], sessions: {}, metadata: {} } },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: 'resource-1',
      kickoffKey: 'kickoff-1',
      kickoffMessage: null,
    });
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      ingress: { identity: 'ask', triggerType: 'test' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: (await seed.workItems.get({ orgId: 'org-1', id: item.id }))!.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [{ type: 'invokeSkill', role: 'work', skillName: 'understand-issue', idempotencyKey: 'ask' }],
      causalChain: [],
      now: NOW,
    });
    const [claimed] = await seed.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now: NOW,
      leaseExpiresAt: new Date(NOW.getTime() + 60_000),
      limit: 1,
    });
    const suspension = {
      toolName: parked.toolName ?? 'ask_user',
      toolCallId: 'call-1',
      question: 'Which database should the fixture use?',
      ...(parked.options ? { options: parked.options } : {}),
      ...(parked.selectionMode ? { selectionMode: parked.selectionMode } : {}),
      session: { bindingId: binding.id, resourceId: binding.resourceId, threadId: binding.threadId },
    };
    const decision = (await seed.workItems.failDeferredDecision({
      id: claimed!.id,
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      ownerId: 'worker-1',
      now: NOW,
      availableAt: NOW,
      lastError: 'Factory run is waiting on ask_user for an answer.',
      failureCode: (parked.failureCode ?? 'run_awaiting_input') as never,
      terminal: true,
      ...(parked.withSuspension === false ? {} : { suspension }),
    }))!;
    await seed.workItems.syncSupervisorFindings({
      ...SCOPE,
      findings: [finding(`decision-failed:${decision.id}`)],
      now: NOW,
    });
    return { decision, binding, item };
  }

  type Boundary =
    | { type: 'agent_end'; reason: 'complete' | 'aborted' | 'error' | 'suspended' }
    | { type: 'error'; error: unknown }
    | { type: 'tool_suspended'; toolCallId: string; toolName: string; args?: unknown; suspendPayload?: unknown };

  /**
   * Behaves like core: an unknown suspension is a silent no-op; a known one is
   * consumed once and the call settles at the resumed run's next boundary,
   * which is emitted to subscribers (a completed run by default). `delayMs`
   * holds the boundary back, as a real run would for minutes.
   */
  function fakeSession(
    parkedCallIds: string[] = ['call-1'],
    boundary: Boundary | Error = { type: 'agent_end', reason: 'complete' },
    delayMs = 0,
  ) {
    const parked = new Set(parkedCallIds);
    const listeners = new Set<(event: Boundary) => void>();
    const emit = (event: Boundary) => {
      if (event.type === 'tool_suspended') parked.add(event.toolCallId);
      for (const listener of listeners) listener(event);
    };
    const respondToToolSuspension = vi.fn(async ({ toolCallId }: { resumeData: unknown; toolCallId?: string }) => {
      if (!toolCallId || !parked.has(toolCallId)) return;
      parked.delete(toolCallId);
      if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
      emit(boundary instanceof Error ? { type: 'error', error: boundary } : boundary);
    });
    return {
      suspensions: { has: ({ toolCallId }: { toolCallId: string }) => parked.has(toolCallId) },
      respondToToolSuspension,
      subscribe: (listener: (event: Boundary) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }

  async function answerSetup(
    parked: Parked = {},
    session: ReturnType<typeof fakeSession> | undefined = fakeSession(),
    overrides: {
      actor?: { type: 'human' | 'agent'; id: string };
      audit?: { record: () => Promise<never> };
      warn?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    const seed = await createFactoryStorageForTests();
    const seeded = await parkDecision(seed, parked);
    const getSessionByResource = vi.fn(async (resourceId: string) =>
      resourceId === seeded.binding.resourceId ? session : undefined,
    );
    const notify = vi.fn(async () => {});
    const tools = createFactorySupervisorActionTools({
      scope: SCOPE,
      actor: overrides.actor ?? { type: 'agent', id: 'agent:thread-1' },
      workItems: seed.workItems,
      audit: overrides.audit ?? seed.audit,
      controller: { getSessionByResource },
      notifySupervisor: notify,
      ...(overrides.warn ? { logger: { warn: overrides.warn } } : {}),
      now: () => NOW,
      resumeAckMs: 50,
    });
    const events = async () =>
      (await seed.audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID, limit: 10 })).events;
    return { ...seed, ...seeded, tools, session, getSessionByResource, notify, events };
  }

  it('is approval-free and registers beside the escalate tool', async () => {
    const { tools } = await answerSetup();
    expect((tools.factory_answer_suspension as { requireApproval?: boolean }).requireApproval).toBeFalsy();
  });

  it('answers a free-text question with a string and resumes exactly that suspension', async () => {
    const { tools, decision, session, getSessionByResource, events, workItems } = await answerSetup();

    const result = await execute<any>(tools.factory_answer_suspension, {
      decisionId: decision.id,
      answer: 'Use libsql.',
    });

    expect(result).toEqual({
      decisionId: decision.id,
      outcome: 'answered',
      question: 'Which database should the fixture use?',
      answer: 'Use libsql.',
      answerAudited: true,
      run: 'completed',
      decisionStatus: 'succeeded',
      note: expect.any(String),
    });
    // The decision is done, so the next sweep has no failed decision to report.
    const after = (await workItems.getDeferredDecision('org-1', PROJECT_ID, decision.id))!;
    expect(after.status).toBe('succeeded');
    expect(computeFactoryHealth({ ...emptyHealthInputs, decisions: [after] }, NOW).findings).toEqual([]);
    expect(getSessionByResource).toHaveBeenCalledWith('resource-1');
    expect(session.respondToToolSuspension).toHaveBeenCalledWith({ resumeData: 'Use libsql.', toolCallId: 'call-1' });
    expect((await events())[0]).toMatchObject({
      action: 'factory.supervisor.suspension_answered',
      actorType: 'agent',
      actorId: 'agent:thread-1',
      targets: [{ type: 'deferred_decision', id: decision.id }],
      metadata: { cause: 'supervisor', toolCallId: 'call-1', answer: 'Use libsql.' },
    });
  });

  it('accepts the finding key in place of the decision id', async () => {
    const { tools, decision, session } = await answerSetup();
    await execute(tools.factory_answer_suspension, { findingKey: `decision-failed:${decision.id}`, answer: 'yes' });
    expect(session.respondToToolSuspension).toHaveBeenCalledTimes(1);
  });

  it('builds a single option or a multi-select list against the offered options', async () => {
    const single = await answerSetup({ options: ['postgres', 'libsql'], selectionMode: 'single_select' });
    await execute(single.tools.factory_answer_suspension, { decisionId: single.decision.id, answer: 'LibSQL' });
    expect(single.session.respondToToolSuspension).toHaveBeenCalledWith({ resumeData: 'libsql', toolCallId: 'call-1' });

    const multi = await answerSetup({ options: ['a', 'b', 'c'], selectionMode: 'multi_select' });
    await execute(multi.tools.factory_answer_suspension, { decisionId: multi.decision.id, answer: ['a', 'c'] });
    expect(multi.session.respondToToolSuspension).toHaveBeenCalledWith({
      resumeData: ['a', 'c'],
      toolCallId: 'call-1',
    });
  });

  it('escalates instead of submitting an answer that is not among the options', async () => {
    const { tools, decision, session, workItems, events } = await answerSetup({ options: ['postgres', 'libsql'] });

    const result = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'mysql' });

    expect(result).toMatchObject({ outcome: 'escalated', escalationAudited: true });
    expect(session.respondToToolSuspension).not.toHaveBeenCalled();
    const row = (await workItems.listSupervisorFindingPage({ ...SCOPE, limit: 5 })).rows[0];
    expect(row).toMatchObject({ status: 'escalated' });
    expect(row?.escalationNote).toContain('not one of the offered options');
    expect((await events())[0]).toMatchObject({ action: 'factory.supervisor.suspension_escalated' });
  });

  it('escalates a parked plan by default and never approves it', async () => {
    const { tools, decision, session, workItems } = await answerSetup({
      toolName: 'submit_plan',
      failureCode: 'plan_awaiting_approval',
    });

    const result = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'approved' });

    expect(result).toMatchObject({ outcome: 'escalated' });
    expect(session.respondToToolSuspension).not.toHaveBeenCalled();
    expect((await workItems.listSupervisorFindingPage({ ...SCOPE, limit: 5 })).rows[0]?.escalationNote).toContain(
      'a person should review it',
    );
  });

  it('escalates an unknown suspended tool and a pre-capture row rather than guessing a resume shape', async () => {
    const unknown = await answerSetup({ toolName: 'custom_gate' });
    expect(
      await execute<any>(unknown.tools.factory_answer_suspension, { decisionId: unknown.decision.id, answer: 'go' }),
    ).toMatchObject({
      outcome: 'escalated',
    });
    expect(unknown.session.respondToToolSuspension).not.toHaveBeenCalled();

    const legacy = await answerSetup({ withSuspension: false });
    const result = await execute<any>(legacy.tools.factory_answer_suspension, {
      decisionId: legacy.decision.id,
      answer: 'go',
    });
    expect(result).toMatchObject({ outcome: 'escalated' });
    expect(result.note).toContain('before questions were captured');
  });

  it('reports already-handled when the question is no longer parked, and a double answer is benign', async () => {
    // A person answered from the session (or the process restarted): the
    // decision still reads failed, but the registry no longer holds the call.
    const handled = await answerSetup({}, fakeSession([]));
    expect(
      await execute<any>(handled.tools.factory_answer_suspension, { decisionId: handled.decision.id, answer: 'x' }),
    ).toMatchObject({ outcome: 'already-handled', reason: expect.stringContaining('restarted') });
    expect(handled.session.respondToToolSuspension).not.toHaveBeenCalled();

    // A second answer after our own: the run finished, the decision is done.
    const { tools, decision, session } = await answerSetup();
    await execute(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'first' });
    const second = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'second' });
    expect(second).toMatchObject({ outcome: 'not-parked' });
    expect(session.respondToToolSuspension).toHaveBeenCalledTimes(1);
  });

  it('fails closed on a revoked binding and on a decision outside its factory', async () => {
    const { tools, decision, binding, session, workItems } = await answerSetup();
    await workItems.revokeRunBinding({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      bindingId: binding.id,
      revokedAt: NOW,
    });
    const result = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'x' });
    expect(result).toMatchObject({ outcome: 'escalated' });
    expect(result.note).toContain('revoked');
    expect(session.respondToToolSuspension).not.toHaveBeenCalled();

    const foreign = createFactorySupervisorActionTools({
      scope: { orgId: 'org-1', factoryProjectId: '99999999-2222-4333-8444-555555555555' },
      actor: { type: 'agent', id: 'agent:other' },
      workItems,
      audit: (await answerSetup()).audit,
      controller: { getSessionByResource: async () => session },
      now: () => NOW,
    });
    await expect(execute(foreign.factory_answer_suspension, { decisionId: decision.id, answer: 'x' })).rejects.toThrow(
      /No such decision/,
    );
  });

  it('does nothing for a decision that is not parked on a question', async () => {
    const { tools, decision, session } = await answerSetup({ failureCode: 'session_unavailable' });
    const result = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'x' });
    expect(result).toMatchObject({ outcome: 'not-parked' });
    expect(session.respondToToolSuspension).not.toHaveBeenCalled();
  });

  it('refuses a decision id and finding key that disagree', async () => {
    const { tools, decision } = await answerSetup();
    await expect(
      execute(tools.factory_answer_suspension, {
        decisionId: decision.id,
        findingKey: 'decision-failed:other',
        answer: 'x',
      }),
    ).rejects.toThrow(/different decisions/);
  });

  it('escalates when the recorded session does not match the binding (resource or thread)', async () => {
    for (const drift of [{ resourceId: 'someone-elses-resource' }, { threadId: 'another-thread' }]) {
      const seed = await createFactoryStorageForTests();
      const { decision, binding } = await parkDecision(seed);
      // A record whose correlation drifted from the binding it names.
      const drifted = {
        ...decision,
        suspension: { ...decision.suspension!, session: { ...decision.suspension!.session, ...drift } },
      };
      const session = fakeSession();
      const getSessionByResource = vi.fn(async () => session);
      const tools = createFactorySupervisorActionTools({
        scope: SCOPE,
        actor: { type: 'agent', id: 'agent:thread-1' },
        workItems: {
          getDeferredDecision: async () => drifted,
          listRunBindings: (...args: Parameters<typeof seed.workItems.listRunBindings>) =>
            seed.workItems.listRunBindings(...args),
          escalateSupervisorFinding: (...args: Parameters<typeof seed.workItems.escalateSupervisorFinding>) =>
            seed.workItems.escalateSupervisorFinding(...args),
          resolveAnsweredDecision: async () => null,
          reparkDecision: async () => null,
        },
        audit: seed.audit,
        controller: { getSessionByResource },
        now: () => NOW,
      });
      expect(binding.status).toBe('active');
      const result = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'x' });
      expect(result).toMatchObject({ outcome: 'escalated' });
      expect(result.note).toContain('no longer matches its binding');
      expect(getSessionByResource).not.toHaveBeenCalled();
      expect(session.respondToToolSuspension).not.toHaveBeenCalled();
    }
  });

  it('escalates, and does not claim an answer, when the run fails while resuming', async () => {
    const warn = vi.fn();
    const { tools, decision, workItems, events } = await answerSetup(
      {},
      fakeSession(['call-1'], new Error('snapshot gone')),
      {
        warn,
      },
    );
    const result = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'x' });
    expect(result).toMatchObject({ outcome: 'escalated' });
    expect(result.note).toContain('failed while resuming');
    expect((await workItems.listSupervisorFindingPage({ ...SCOPE, limit: 5 })).rows[0]).toMatchObject({
      status: 'escalated',
    });
    // The answer was submitted (audited as such), and the failure that followed is escalated.
    expect((await events()).map(e => e.action).sort()).toEqual([
      'factory.supervisor.suspension_answered',
      'factory.supervisor.suspension_escalated',
    ]);
    expect(warn).toHaveBeenCalledWith(
      'Factory supervisor answer did not carry the run to completion',
      expect.objectContaining({ error: 'snapshot gone' }),
    );
  });

  it('reports an answer (or escalation) that landed even when the audit write fails', async () => {
    const warn = vi.fn();
    const failing = {
      record: async () => {
        throw new Error('audit store down at postgres://secret');
      },
    };
    const answered = await answerSetup({}, fakeSession(), { audit: failing, warn });
    const result = await execute<any>(answered.tools.factory_answer_suspension, {
      decisionId: answered.decision.id,
      answer: 'x',
    });
    expect(result).toMatchObject({ outcome: 'answered', answerAudited: false, auditError: expect.any(String) });
    expect(result.auditError).not.toContain('postgres');
    expect(answered.session.respondToToolSuspension).toHaveBeenCalledTimes(1);

    const escalated = await answerSetup(
      { toolName: 'submit_plan', failureCode: 'plan_awaiting_approval' },
      fakeSession(),
      { audit: failing, warn },
    );
    const second = await execute<any>(escalated.tools.factory_answer_suspension, {
      decisionId: escalated.decision.id,
      answer: 'x',
    });
    expect(second).toMatchObject({ outcome: 'escalated', escalationAudited: false });
    expect((await escalated.workItems.listSupervisorFindingPage({ ...SCOPE, limit: 5 })).rows[0]).toMatchObject({
      status: 'escalated',
    });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('throws instead of claiming an escalation when the finding is not open', async () => {
    const { tools, decision, workItems, events } = await answerSetup({
      toolName: 'submit_plan',
      failureCode: 'plan_awaiting_approval',
    });
    await workItems.syncSupervisorFindings({ ...SCOPE, findings: [], now: new Date(NOW.getTime() + 1_000) });
    await expect(execute(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'x' })).rejects.toThrow(
      /not open/,
    );
    expect(await events()).toEqual([]);
  });

  it('attributes the answer to the human on an authenticated turn', async () => {
    const { tools, decision, events } = await answerSetup({}, fakeSession(), {
      actor: { type: 'human', id: 'user-7' },
    });
    await execute(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'x' });
    expect((await events())[0]).toMatchObject({
      action: 'factory.supervisor.suspension_answered',
      actorType: 'human',
      actorId: 'user-7',
    });
  });

  it('records a run that parks on a second question, rings, and answers the new suspension next time', async () => {
    const second = {
      type: 'tool_suspended' as const,
      toolCallId: 'call-2',
      toolName: 'ask_user',
      suspendPayload: { question: 'And which port?', options: [{ label: '5432' }, { label: '5433' }] },
    };
    const { tools, decision, session, notify, workItems } = await answerSetup({}, fakeSession(['call-1'], second));

    const first = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'libsql' });
    expect(first).toMatchObject({
      outcome: 'answered',
      run: 'parked-again',
      nextQuestion: 'And which port?',
      nextOptions: ['5432', '5433'],
    });
    const reparked = (await workItems.getDeferredDecision('org-1', PROJECT_ID, decision.id))!;
    expect(reparked.status).toBe('failed');
    expect(reparked.suspension).toMatchObject({
      toolCallId: 'call-2',
      question: 'And which port?',
      options: ['5432', '5433'],
    });
    expect(reparked.suspension?.session).toEqual(decision.suspension?.session);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        findingKey: `decision-failed:${decision.id}`,
        priority: 'high',
        failureCode: 'run_awaiting_input',
        summary: expect.stringContaining('And which port?'),
      }),
    );
    // The finding a woken supervisor reads already carries question two.
    const row = (await workItems.listSupervisorFindingPage({ ...SCOPE, limit: 5 })).rows.find(
      r => r.findingKey === `decision-failed:${decision.id}`,
    )!;
    expect(row.finding.evidence).toContain('And which port?');
    expect(row.finding.evidence).not.toContain('Which database should the fixture use?');
    expect(row.resolvedAt).toBeNull();
    expect(first).toMatchObject({ recorded: true });

    const again = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: '5433' });
    expect(again).toMatchObject({ outcome: 'answered' });
    expect(session.respondToToolSuspension).toHaveBeenLastCalledWith({ resumeData: '5433', toolCallId: 'call-2' });
  });

  it('acknowledges a long run as proceeding and records its end when it comes', async () => {
    const { tools, decision, workItems } = await answerSetup(
      {},
      fakeSession(['call-1'], { type: 'agent_end', reason: 'complete' }, 200),
    );
    const result = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'x' });
    expect(result).toMatchObject({ outcome: 'answered', run: 'proceeding' });
    expect((await workItems.getDeferredDecision('org-1', PROJECT_ID, decision.id))!.status).toBe('failed');
    await vi.waitFor(async () => {
      expect((await workItems.getDeferredDecision('org-1', PROJECT_ID, decision.id))!.status).toBe('succeeded');
    });
  });

  it('escalates when the answered run aborts instead of finishing', async () => {
    const { tools, decision, workItems } = await answerSetup(
      {},
      fakeSession(['call-1'], { type: 'agent_end', reason: 'aborted' }),
    );
    const result = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'x' });
    expect(result).toMatchObject({ outcome: 'escalated' });
    expect(result.note).toContain('ended without finishing');
    expect((await workItems.getDeferredDecision('org-1', PROJECT_ID, decision.id))!.status).toBe('failed');
  });

  it('escalates a question whose choices could not be captured verbatim', async () => {
    const seed = await createFactoryStorageForTests();
    const { decision } = await parkDecision(seed);
    const omitted = { ...decision, suspension: { ...decision.suspension!, optionsOmitted: true as const } };
    const session = fakeSession();
    const tools = createFactorySupervisorActionTools({
      scope: SCOPE,
      actor: { type: 'agent', id: 'agent:thread-1' },
      workItems: {
        getDeferredDecision: async () => omitted,
        listRunBindings: (...args: Parameters<typeof seed.workItems.listRunBindings>) =>
          seed.workItems.listRunBindings(...args),
        escalateSupervisorFinding: (...args: Parameters<typeof seed.workItems.escalateSupervisorFinding>) =>
          seed.workItems.escalateSupervisorFinding(...args),
        resolveAnsweredDecision: async () => null,
        reparkDecision: async () => null,
      },
      audit: seed.audit,
      controller: { getSessionByResource: async () => session },
      now: () => NOW,
    });
    const result = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'anything' });
    expect(result).toMatchObject({ outcome: 'escalated' });
    expect(result.note).toContain('could not be captured verbatim');
    expect(session.respondToToolSuspension).not.toHaveBeenCalled();
  });

  it('bounds generated escalation notes and the answer input', async () => {
    const { tools, decision, workItems } = await answerSetup({
      toolName: 'submit_plan',
      failureCode: 'plan_awaiting_approval',
    });
    const result = await execute<any>(tools.factory_answer_suspension, {
      decisionId: decision.id,
      answer: 'y'.repeat(600),
    });
    expect(result).toMatchObject({ outcome: 'escalated' });
    expect(result.note.length).toBeLessThanOrEqual(600);
    expect(
      (await workItems.listSupervisorFindingPage({ ...SCOPE, limit: 5 })).rows[0]?.escalationNote?.length,
    ).toBeLessThanOrEqual(600);
    await expect(
      execute<{ error?: boolean }>(tools.factory_answer_suspension, {
        decisionId: decision.id,
        answer: 'y'.repeat(601),
      }),
    ).resolves.toMatchObject({ error: true });
  });

  it('does not claim a transition the storage refused, and rings for a live run nothing tracks any more', async () => {
    const second = {
      type: 'tool_suspended' as const,
      toolCallId: 'call-2',
      toolName: 'ask_user',
      suspendPayload: { question: 'Again?' },
    };
    const cases = [
      {
        boundary: second,
        revoke: false,
        expected: { run: 'parked-again', recorded: false, orphaned: true },
        rings: true,
      },
      {
        boundary: second,
        revoke: true,
        expected: { run: 'parked-again', recorded: false, orphaned: false },
        rings: false,
      },
      {
        boundary: { type: 'agent_end' as const, reason: 'complete' as const },
        revoke: false,
        expected: { run: 'completed', decisionStatus: 'unchanged' },
        rings: false,
      },
    ];
    for (const { boundary, revoke, expected, rings } of cases) {
      const seed = await createFactoryStorageForTests();
      const { decision, binding } = await parkDecision(seed);
      const notify = vi.fn(async () => {});
      const session = fakeSession(['call-1'], boundary);
      // The binding check happens before the resume, so pull the seat only once the run parks again.
      const listRunBindings = async (...args: Parameters<typeof seed.workItems.listRunBindings>) => {
        const rows = await seed.workItems.listRunBindings(...args);
        return revoke && session.respondToToolSuspension.mock.calls.length > 0
          ? rows.map(row => (row.id === binding.id ? { ...row, status: 'revoked' as const } : row))
          : rows;
      };
      const tools = createFactorySupervisorActionTools({
        scope: SCOPE,
        actor: { type: 'agent', id: 'agent:thread-1' },
        workItems: {
          getDeferredDecision: (...args: Parameters<typeof seed.workItems.getDeferredDecision>) =>
            seed.workItems.getDeferredDecision(...args),
          listRunBindings,
          escalateSupervisorFinding: (...args: Parameters<typeof seed.workItems.escalateSupervisorFinding>) =>
            seed.workItems.escalateSupervisorFinding(...args),
          openSupervisorFinding: (...args: Parameters<typeof seed.workItems.openSupervisorFinding>) =>
            seed.workItems.openSupervisorFinding(...args),
          markSupervisorFindingNotified: (...args: Parameters<typeof seed.workItems.markSupervisorFindingNotified>) =>
            seed.workItems.markSupervisorFindingNotified(...args),
          get: (...args: Parameters<typeof seed.workItems.get>) => seed.workItems.get(...args),
          // Both compare-and-set writes lose: the decision is no longer failed.
          resolveAnsweredDecision: async () => null,
          reparkDecision: async () => null,
        },
        audit: seed.audit,
        controller: { getSessionByResource: async () => session },
        notifySupervisor: notify,
        now: () => NOW,
        resumeAckMs: 50,
      });
      const result = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'x' });
      expect(result).toMatchObject({ outcome: 'answered', ...expected });
      if (rings) {
        expect(notify).toHaveBeenCalledWith(
          expect.objectContaining({ summary: expect.stringContaining('nothing tracks the run') }),
        );
      } else {
        expect(notify).not.toHaveBeenCalled();
      }
    }
  });

  it('leaves a re-parked finding un-stamped when the ring fails, so the sweep re-rings it', async () => {
    const second = {
      type: 'tool_suspended' as const,
      toolCallId: 'call-2',
      toolName: 'ask_user',
      suspendPayload: { question: 'And which port?' },
    };
    const warn = vi.fn();
    const { tools, decision, workItems, notify } = await answerSetup({}, fakeSession(['call-1'], second), { warn });
    notify.mockRejectedValueOnce(new Error('notifications down'));
    const key = `decision-failed:${decision.id}`;

    const result = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'x' });

    expect(result).toMatchObject({ run: 'parked-again', recorded: true });
    const unnotified = await workItems.listUnnotifiedSupervisorFindings({ ...SCOPE, limit: 10 });
    const row = unnotified.find(r => r.findingKey === key)!;
    expect(row).toBeDefined();
    expect(row.lastNotifiedAt).toBeNull();
    expect(row.finding.evidence).toContain('And which port?');
    expect(warn).toHaveBeenCalledWith('Factory supervisor could not ring for a re-parked run', expect.anything());

    // A ring that lands stamps the row, occurrence-safe.
    const again = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'x' });
    expect(again).toMatchObject({ run: 'parked-again', recorded: true });
    const stamped = (await workItems.listSupervisorFindingPage({ ...SCOPE, limit: 10 })).rows.find(
      r => r.findingKey === key,
    )!;
    expect(stamped.lastNotifiedAt).toBeInstanceOf(Date);
  });

  it('keeps the answer audit and the escalation audit apart on a fast failure', async () => {
    const { tools, decision } = await answerSetup({}, fakeSession(['call-1'], new Error('boom')));
    const result = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'x' });
    expect(result).toMatchObject({ outcome: 'escalated', answerAudited: true, escalationAudited: true });
  });

  it('an older re-park settling late never regresses the finding to its question', async () => {
    // Two answers race: the first run's re-park (q2) is slow between its
    // decision write and its finding refresh; meanwhile q2 is answered and
    // q3 is parked and published. The late q2 refresh must be a no-op.
    const seed = await createFactoryStorageForTests();
    const { decision } = await parkDecision(seed);
    const key = `decision-failed:${decision.id}`;
    const notify = vi.fn(async () => {});
    const q2 = {
      type: 'tool_suspended' as const,
      toolCallId: 'call-2',
      toolName: 'ask_user',
      suspendPayload: { question: 'q2?' },
    };
    const q3 = {
      type: 'tool_suspended' as const,
      toolCallId: 'call-3',
      toolName: 'ask_user',
      suspendPayload: { question: 'q3?' },
    };
    // A purpose-built session: consuming a parked call emits the current
    // boundary and parks its call id, so the next answer targets it.
    const parked = new Set(['call-1']);
    const listeners = new Set<(event: typeof q2) => void>();
    let boundary = q2;
    const session = {
      suspensions: { has: ({ toolCallId }: { toolCallId: string }) => parked.has(toolCallId) },
      respondToToolSuspension: vi.fn(async ({ toolCallId }: { resumeData: unknown; toolCallId?: string }) => {
        if (!toolCallId || !parked.has(toolCallId)) return;
        parked.delete(toolCallId);
        parked.add(boundary.toolCallId);
        for (const listener of listeners) listener(boundary);
      }),
      subscribe: (listener: (event: typeof q2) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    // Hold the older refresh: gate `get` (called between reparkDecision and openSupervisorFinding).
    let releaseOlder!: () => void;
    const olderHeld = new Promise<void>(resolve => (releaseOlder = resolve));
    let holds = 0;
    const tools = createFactorySupervisorActionTools({
      scope: SCOPE,
      actor: { type: 'agent', id: 'agent:thread-1' },
      workItems: {
        getDeferredDecision: (...args: Parameters<typeof seed.workItems.getDeferredDecision>) =>
          seed.workItems.getDeferredDecision(...args),
        listRunBindings: (...args: Parameters<typeof seed.workItems.listRunBindings>) =>
          seed.workItems.listRunBindings(...args),
        escalateSupervisorFinding: (...args: Parameters<typeof seed.workItems.escalateSupervisorFinding>) =>
          seed.workItems.escalateSupervisorFinding(...args),
        openSupervisorFinding: (...args: Parameters<typeof seed.workItems.openSupervisorFinding>) =>
          seed.workItems.openSupervisorFinding(...args),
        markSupervisorFindingNotified: (...args: Parameters<typeof seed.workItems.markSupervisorFindingNotified>) =>
          seed.workItems.markSupervisorFindingNotified(...args),
        resolveAnsweredDecision: (...args: Parameters<typeof seed.workItems.resolveAnsweredDecision>) =>
          seed.workItems.resolveAnsweredDecision(...args),
        reparkDecision: (...args: Parameters<typeof seed.workItems.reparkDecision>) =>
          seed.workItems.reparkDecision(...args),
        get: async (...args: Parameters<typeof seed.workItems.get>) => {
          holds += 1;
          if (holds === 1) await olderHeld;
          return seed.workItems.get(...args);
        },
      },
      audit: seed.audit,
      controller: { getSessionByResource: async () => session },
      notifySupervisor: notify,
      now: () => new Date(),
      resumeAckMs: 5_000,
    });

    const older = execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'a1' });
    await vi.waitFor(() => expect(holds).toBe(1));
    // q2 is on the decision now; answer it, and let that run park on q3 and publish.
    boundary = q3;
    const newer = await execute<any>(tools.factory_answer_suspension, { decisionId: decision.id, answer: 'a2' });
    expect(newer).toMatchObject({ run: 'parked-again', recorded: true, nextQuestion: 'q3?' });
    const published = (await seed.workItems.listSupervisorFindingPage({ ...SCOPE, limit: 5 })).rows.find(
      r => r.findingKey === key,
    )!;
    expect(published.finding.evidence).toContain('q3?');
    expect(published.lastNotifiedAt).toBeInstanceOf(Date);

    releaseOlder();
    const olderResult = await older;
    expect(olderResult).toMatchObject({ run: 'parked-again', recorded: false });
    const after = (await seed.workItems.listSupervisorFindingPage({ ...SCOPE, limit: 5 })).rows.find(
      r => r.findingKey === key,
    )!;
    expect(after.finding.evidence).toContain('q3?');
    expect(after.occurrence).toBe(published.occurrence);
    expect(after.lastNotifiedAt?.getTime()).toBe(published.lastNotifiedAt?.getTime());
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
