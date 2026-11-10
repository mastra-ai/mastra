import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { json, pending, startAssistant } from './helpers';

const agent = 'personalAssistant';

test('native objectives and tasks preserve unfinished work across restart', { timeout: 120000 }, async () => {
  const { progressFixture, progressState, progressTurn, taskPlan } = await import('./progress');
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-progress-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  const thread = 'meeting-progress';
  try {
    app = await startAssistant(dataDir, fixture.modelUrl);
    assert.equal((await progressState(dataDir, thread)).objective, undefined, 'Boot must not create an objective.');
    await progressTurn(app, thread, {
      calls: [
        [
          {
            name: 'objective',
            args: {
              action: 'set',
              objective: 'Prepare a meeting agenda and wait for owner review.',
            },
          },
        ],
        [{ name: 'task_check', args: {} }],
        [{ name: 'task_write', args: { tasks: taskPlan } }],
        [{ name: 'task_complete', args: { id: 'research' } }],
        [{ name: 'task_update', args: { id: 'draft', status: 'in_progress' } }],
        [{ name: 'task_update', args: { id: 'review', status: 'in_progress' } }],
      ],
    });
    const before = await progressState(dataDir, thread);
    assert.equal(before.objective?.status, 'active');
    assert.equal(before.objective?.runsUsed, 1);
    assert.deepEqual(
      before.tasks.map(task => [task.id, task.status]),
      [
        ['research', 'completed'],
        ['draft', 'pending'],
        ['review', 'in_progress'],
      ],
    );
    assert.equal(before.tasks.filter(task => task.status === 'in_progress').length, 1);
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl);
    assert.deepEqual(await progressState(dataDir, thread), before);
    const boundary = fixture.models.length;
    const inspected = await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'inspect' } }], [{ name: 'task_check', args: {} }]],
    });
    assert.match(inspected.text, /Draft the agenda/);
    const input = JSON.stringify(fixture.models[boundary]!.messages);
    assert.match(input, /Prepare a meeting agenda/);
    assert.match(input, /Draft the agenda/);
    assert.match(input, /Review with the owner/);
    const stable = await progressState(dataDir, thread);
    const rejected = await progressTurn(app, thread, {
      calls: [[{ name: 'task_check', args: {} }], [{ name: 'task_write', args: { tasks: [taskPlan[0]] } }]],
    });
    assert.match(JSON.stringify(rejected), /unfinished task|tripwire/i);
    assert.deepEqual(
      (await progressState(dataDir, thread)).tasks,
      stable.tasks,
      'Unsafe native replacement must not drop unfinished entries.',
    );
    const invalid = await progressTurn(app, thread, {
      calls: [
        [{ name: 'task_check', args: {} }],
        [
          {
            name: 'task_write',
            args: { tasks: stable.tasks.map(task => ({ ...task, status: 'in_progress' })) },
          },
        ],
      ],
    });
    assert.match(invalid.text, /only one task|one task.*in_progress|at most one/i);
    assert.deepEqual(
      (await progressState(dataDir, thread)).tasks,
      stable.tasks,
      'Native validation must reject multiple in-progress tasks.',
    );
    const freshRequest = fixture.models.length;
    const batch = await progressTurn(app, thread, {
      calls: [
        [
          { name: 'task_write', args: { tasks: stable.tasks } },
          { name: 'task_write', args: { tasks: [stable.tasks[0]] } },
        ],
      ],
    });
    assert.match(batch.text, /unfinished task/);
    assert.deepEqual(
      (await progressState(dataDir, thread)).tasks,
      stable.tasks,
      'Each native hook must read state immediately before its mutation.',
    );
    assert.ok(fixture.models.length > freshRequest);

    const isolatedBoundary = fixture.models.length;
    await progressTurn(app, 'separate-progress', { calls: [[{ name: 'task_check', args: {} }]] });
    assert.deepEqual((await progressState(dataDir, 'separate-progress')).tasks, []);
    assert.equal((await progressState(dataDir, 'separate-progress')).objective, undefined);
    assert.doesNotMatch(
      JSON.stringify(fixture.models[isolatedBoundary]!.messages),
      /Prepare a meeting agenda|Draft the agenda/,
    );
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('objective conflicts and exhausted budgets require explicit continuation', { timeout: 120000 }, async () => {
  const { progressFixture, progressState, progressTurn } = await import('./progress');
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-goal-budget-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  const thread = 'bounded-goal';
  const objective = 'Prepare a grounded agenda, then wait for owner verification.';
  try {
    app = await startAssistant(dataDir, fixture.modelUrl);
    fixture.state.continueGoal = true;
    await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'set', objective, maxEvaluations: 2 } }]],
    });
    const exhausted = (await progressState(dataDir, thread)).objective!;
    assert.equal(exhausted.status, 'paused');
    assert.equal(exhausted.runsUsed, 2);
    assert.equal(exhausted.maxRuns, 2);
    assert.match(exhausted.pausedReason!, /budget/);
    assert.equal(fixture.judges.length, 2, 'The real native loop must stop after exactly two judge evaluations.');
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl);
    assert.deepEqual(
      (await progressState(dataDir, thread)).objective,
      exhausted,
      'Exhausted usage and paused state must survive a full restart.',
    );

    const repeated = await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'set', objective, maxEvaluations: 5 } }]],
    });
    assert.match(repeated.text, /usage preserved/);
    assert.deepEqual((await progressState(dataDir, thread)).objective, exhausted);
    const conflict = await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'set', objective: 'Unrelated travel plans' } }]],
    });
    assert.match(conflict.text, /explicit replacement|separate conversation/);
    assert.deepEqual((await progressState(dataDir, thread)).objective, exhausted);
    const noBudget = await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'resume' } }]],
    });
    assert.match(noBudget.text, /additional evaluation allowance/);
    assert.deepEqual((await progressState(dataDir, thread)).objective, exhausted);
    for (const invalid of [
      { action: 'set', objective: 'Bad limit', maxEvaluations: 0 },
      { action: 'set', objective: 'Bad limit', maxEvaluations: 6 },
      { action: 'resume', additionalEvaluations: 1.5 },
      { action: 'inspect', objective: 'Unexpected field' },
      { action: 'clear' },
      {
        action: 'set',
        objective: 'Thread injection',
        threadId: 'another-thread',
        ownerId: 'foreign-owner',
      },
    ]) {
      await progressTurn(app, thread, { calls: [[{ name: 'objective', args: invalid }]] });
      assert.deepEqual((await progressState(dataDir, thread)).objective, exhausted);
    }
    fixture.state.continueGoal = false;
    await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'resume', additionalEvaluations: 1 } }]],
    });
    const waiting = (await progressState(dataDir, thread)).objective!;
    assert.equal(waiting.id, exhausted.id);
    assert.equal(waiting.runsUsed, 3);
    assert.equal(waiting.maxRuns, 3);
    assert.equal(waiting.status, 'active', 'Waiting on the final slot stays active until the next native guard.');
    const count = fixture.judges.length;
    await progressTurn(app, thread, {});
    assert.equal(fixture.judges.length, count, 'The exhausted native guard must pause without another judge request.');
    const guarded = (await progressState(dataDir, thread)).objective!;
    assert.equal(guarded.status, 'paused');
    assert.equal(guarded.runsUsed, 3);
    await progressTurn(app, thread, {
      calls: [
        [
          {
            name: 'objective',
            args: {
              action: 'set',
              objective: 'Replacement explicitly requested; wait for input.',
              replaceExisting: true,
            },
          },
        ],
      ],
    });
    const replacement = (await progressState(dataDir, thread)).objective!;
    assert.notEqual(replacement.id, guarded.id);
    assert.equal(replacement.runsUsed, 1);
    await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'pause' } }]],
    });
    assert.equal((await progressState(dataDir, thread)).objective?.status, 'paused');
    fixture.state.failJudge = true;
    await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'resume' } }]],
    });
    const failed = (await progressState(dataDir, thread)).objective!;
    assert.equal(failed.status, 'paused');
    assert.match(failed.pausedReason!, /judge|evaluation|fail/i);
    assert.equal(
      failed.runsUsed,
      replacement.runsUsed,
      'A failed judge must not reset or silently consume completed evaluations.',
    );
    fixture.state.failJudge = false;
    const cleared = await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'clear', confirmClear: true } }]],
    });
    assert.match(cleared.text, /not completed/);
    assert.equal((await progressState(dataDir, thread)).objective, undefined);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('incomplete objectives wait for information and preserve approvals', { timeout: 120000 }, async () => {
  const { progressFixture, progressState, progressTurn, taskPlan } = await import('./progress');
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-goal-approval-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  const thread = 'missing-topic';
  try {
    app = await startAssistant(dataDir, fixture.modelUrl, {
      ...fixture.env,
      TEST_SEED_FOREIGN: 'true',
    });
    const answer = await progressTurn(app, thread, {
      missing: 'the meeting topic',
      calls: [
        [
          {
            name: 'objective',
            args: {
              action: 'set',
              objective:
                'Prepare a meeting document. Wait for the missing topic and native owner approval before creating it.',
            },
          },
        ],
        [{ name: 'task_check', args: {} }],
        [{ name: 'task_write', args: { tasks: taskPlan } }],
      ],
    });
    assert.match(answer.text, /provide the meeting topic/);
    let state = await progressState(dataDir, thread);
    assert.equal(state.objective?.status, 'active');
    assert.equal(state.objective?.runsUsed, 1);
    assert.ok(state.tasks.every(task => task.status !== 'completed'));
    assert.equal(
      fixture.judges.length,
      1,
      'Missing information must stop the native loop after one waiting evaluation.',
    );
    assert.equal(fixture.providerCalls.length, 0);
    const sent = await app.request(`/agents/${agent}/stream`, 'POST', {
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            calls: [
              [
                {
                  name: 'google_docs_create_document',
                  args: { title: 'Agenda: recovery planning' },
                },
              ],
            ],
          }),
        },
      ],
      memory: { thread, resource: 'local-owner' },
      requireToolApproval: false,
    });
    await sent.text();
    const suspended = await pending(app, thread);
    assert.equal(suspended.toolCalls[0]!.toolName, 'google_docs_create_document');
    assert.equal(fixture.providerCalls.length, 0, 'A goal and task plan grant no external permission.');
    state = await progressState(dataDir, thread);
    assert.notEqual(state.objective?.status, 'done');
    assert.ok(state.tasks.every(task => task.status !== 'completed'));
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    assert.deepEqual(await progressState(dataDir, thread), state);
    const recovered = await pending(app, thread);
    assert.equal(recovered.runId, suspended.runId);
    const declined = await app.request(`/agents/${agent}/decline-tool-call-generate`, 'POST', {
      runId: recovered.runId,
      toolCallId: recovered.toolCalls[0]!.toolCallId,
    });
    await declined.text();
    assert.equal(fixture.providerCalls.length, 0, 'Decline after restart must produce no provider mutation.');
    assert.notEqual((await progressState(dataDir, thread)).objective?.status, 'done');
    assert.ok((await progressState(dataDir, thread)).tasks.every(task => task.status !== 'completed'));
    const calls = fixture.models.length;
    const foreign = await app.request(`/agents/${agent}/generate`, 'POST', {
      messages: [
        {
          role: 'user',
          content: JSON.stringify({ calls: [[{ name: 'task_check', args: {} }]] }),
        },
      ],
      memory: { thread: 'foreign-thread', resource: 'foreign-owner' },
    });
    assert.equal(foreign.status, 403);
    assert.equal(fixture.models.length, calls);
    for (const route of [
      'generate',
      'stream',
      'send-message',
      'queue-message',
      'signals',
      'queue-signal',
      'send-tool-approval',
    ]) {
      const body = {
        messages: [],
        threadId: thread,
        resourceId: 'local-owner',
        toolCallConcurrency: 2,
        streamOptions: { toolCallConcurrency: 2 },
        ifIdle: { behavior: 'wake', streamOptions: { toolCallConcurrency: 2 } },
      };
      assert.match(
        (await json(await app.request(`/agents/${agent}/${route}`, 'POST', body), 400)).error,
        /toolCallConcurrency/,
      );
    }
    const form = new FormData();
    form.set('message', 'Do work');
    form.set('ifIdle', JSON.stringify({ behavior: 'wake', streamOptions: { toolCallConcurrency: 3 } }));
    await json(
      await fetch(`${app.url}/api/agents/${agent}/send-message`, { method: 'POST', headers: app.headers, body: form }),
      400,
    );
    assert.equal(fixture.models.length, calls);
    for (const options of [{ hooks: { beforeToolCall: null } }, { eagerToolExecution: true }]) {
      const deniedOverride: Response = await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [],
        ...options,
      });
      assert.equal(deniedOverride.status, 400);
    }
    const successThread = 'approved-document-progress';
    await progressTurn(app, successThread, {
      calls: [
        [
          {
            name: 'objective',
            args: {
              action: 'set',
              objective:
                'Create and fill the meeting agenda document with the reviewed content after native owner approval.',
            },
          },
        ],
        [{ name: 'task_check', args: {} }],
        [
          {
            name: 'task_write',
            args: {
              tasks: [
                {
                  id: 'create',
                  content: 'Create the approved document',
                  activeForm: 'Creating the approved document',
                  status: 'in_progress',
                },
                {
                  id: 'insert',
                  content: 'Insert the reviewed agenda',
                  activeForm: 'Inserting the reviewed agenda',
                  status: 'pending',
                },
              ],
            },
          },
        ],
      ],
    });
    fixture.state.continueGoal = false;
    // A requested completion without real insertion/check results must remain unfinished.
    await progressTurn(app, successThread, { complete: true });
    assert.notEqual((await progressState(dataDir, successThread)).objective?.status, 'done');
    fixture.state.failJudge = false;
    // The Connect fixture's provider state controls the actual HTTP insertion response.
    fixture.providerState.insertStatus = 200;
    fixture.providerState.documentId = 'confirmed-agenda';
    const approvedStart = await progressTurn(app, successThread, {
      complete: true,
      calls: [
        [{ name: 'google_docs_create_document', args: { title: 'Reviewed meeting agenda' } }],
        [
          {
            name: 'google_docs_insert_text',
            args: {
              documentId: 'confirmed-agenda',
              text: 'Review recovery planning and assign follow-ups.',
              location: { index: 1 },
            },
          },
        ],
        [{ name: 'task_complete', args: { id: 'create' } }],
        [{ name: 'task_complete', args: { id: 'insert' } }],
        [{ name: 'task_check', args: {} }],
      ],
    });
    assert.equal(approvedStart.finishReason, 'suspended');
    assert.equal(fixture.providerCalls.length, 0);
    const createPending = await pending(app, successThread);
    const insertedPending = await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: createPending.runId,
        toolCallId: createPending.toolCalls[0]!.toolCallId,
      }),
    );
    assert.equal(insertedPending.finishReason, 'suspended');
    assert.deepEqual(
      fixture.providerCalls.map(call => call.body),
      [{ title: 'Reviewed meeting agenda' }],
    );
    assert.ok((await progressState(dataDir, successThread)).tasks.every(task => task.status !== 'completed'));
    const insertPending = await pending(app, successThread);
    assert.equal(insertPending.toolCalls[0]!.toolName, 'google_docs_insert_text');
    const completed = await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: insertPending.runId,
        toolCallId: insertPending.toolCalls[0]!.toolCallId,
      }),
    );
    assert.match(completed.text, /Verified document content and completed task results/);
    assert.equal(fixture.providerCalls.length, 2);
    assert.match(fixture.providerCalls[1]!.path, /confirmed-agenda:batchUpdate/);
    assert.match(JSON.stringify(fixture.providerCalls[1]!.body), /Review recovery planning and assign follow-ups/);
    const completeState = await progressState(dataDir, successThread);
    assert.equal(completeState.objective?.status, 'done');
    assert.deepEqual(
      completeState.tasks.map(task => task.status),
      ['completed', 'completed'],
    );
    assert.match(JSON.stringify(fixture.judges.at(-1)), /confirmed-agenda/);
    assert.match(JSON.stringify(fixture.judges.at(-1)), /allCompleted/);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('resuming a paused objective extends its remaining evaluation allowance', { timeout: 120000 }, async () => {
  const { progressFixture, progressState, progressTurn } = await import('./progress');
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-goal-extension-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, fixture.modelUrl);
    await progressTurn(app, 'remaining-budget', {
      calls: [[{ name: 'objective', args: { action: 'set', objective: 'Wait for owner input.', maxEvaluations: 5 } }]],
    });
    await progressTurn(app, 'remaining-budget', { calls: [[{ name: 'objective', args: { action: 'pause' } }]] });
    const before = (await progressState(dataDir, 'remaining-budget')).objective!;
    assert.equal(before.status, 'paused');
    assert.ok(before.runsUsed < before.maxRuns!);
    await progressTurn(app, 'remaining-budget', {
      calls: [[{ name: 'objective', args: { action: 'resume', additionalEvaluations: 1 } }]],
    });
    const after = (await progressState(dataDir, 'remaining-budget')).objective!;
    assert.equal(after.id, before.id);
    assert.equal(after.maxRuns, before.maxRuns! + 1);
    assert.equal(after.runsUsed, before.runsUsed + 1);
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl);
    assert.deepEqual((await progressState(dataDir, 'remaining-budget')).objective, after);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('goal judging consumes the same process model allowance as chat', { timeout: 30000 }, async () => {
  const { progressFixture, progressState, progressTurn } = await import('./progress');
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-shared-judge-capacity-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, fixture.modelUrl, {
      ASSISTANT_MAX_MODEL_CALLS_PER_HOUR: '2',
      ASSISTANT_MODEL_MAX_RETRIES: '0',
    });
    await progressTurn(app, 'shared-judge-capacity', {
      calls: [[{ name: 'objective', args: { action: 'set', objective: 'Wait for owner verification.' } }]],
    });
    assert.equal(fixture.models.length, 2);
    assert.equal(fixture.judges.length, 0, 'The judge must not dispatch after chat consumed the shared allowance.');
    const objective = (await progressState(dataDir, 'shared-judge-capacity')).objective!;
    assert.equal(objective.status, 'paused');
    assert.equal(objective.runsUsed, 0);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
