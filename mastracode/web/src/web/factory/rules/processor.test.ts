import { MessageList } from '@mastra/core/agent/message-list';
import { RequestContext } from '@mastra/core/request-context';
import { createSignal } from '@mastra/core/signals';
import { describe, expect, it, vi } from 'vitest';

import type { WorkItemsStorage } from '../../storage/domains/work-items/base';
import { seedFactoryStorageForTests } from '../../storage/test-utils';
import { defaultFactoryRules } from './defaults';
import { FactoryPhaseStateProcessor } from './processor';
import { FactoryTransitionService } from './transition-service';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

function requestContext(overrides: Partial<{ threadId: string; scope: string; authenticated: boolean }> = {}) {
  const context = new RequestContext();
  if (overrides.authenticated !== false) {
    context.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  }
  context.set('controller', {
    resourceId: 'resource-1',
    threadId: overrides.threadId ?? 'thread-1',
    scope: overrides.scope ?? '/worktree',
    getState: () => ({ factoryProjectId: PROJECT_ID }),
  });
  return context;
}

async function prepare(storage: WorkItemsStorage, role = 'work') {
  return storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:1',
          url: 'https://example.test/issues/1',
        },
        title: 'Improve the settings UI',
        stages: ['planning'],
        sessions: {},
        metadata: {},
      },
    },
    role,
    session: { projectPath: '/worktree', branch: 'factory/issue-1', threadId: 'thread-1' },
    resourceId: 'resource-1',
    kickoffKey: 'kickoff-1',
    kickoffMessage: null,
  });
}

function toolMessage(
  options: {
    id?: string;
    toolCallId?: string;
    toolName?: string;
    state?: 'call' | 'result' | 'error';
    result?: unknown;
    args?: unknown;
    createdAt?: Date;
  } = {},
) {
  return {
    id: options.id ?? 'assistant-1',
    role: 'assistant' as const,
    createdAt: options.createdAt ?? new Date('2026-07-18T10:00:00Z'),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: {
      format: 2 as const,
      parts: [
        {
          type: 'tool-invocation' as const,
          toolInvocation: {
            toolCallId: options.toolCallId ?? 'tool-call-1',
            toolName: options.toolName ?? 'submit_plan',
            args: options.args ?? {},
            state: options.state ?? 'result',
            result: options.result ?? { approved: true },
          },
        },
      ],
    },
  };
}

function inputArgs(context: RequestContext, messages: unknown[]) {
  return {
    requestContext: context,
    messages,
    messageList: {},
    steps: [{ toolResults: [{ toolCallId: 'tool-call-1' }] }],
    stepNumber: 1,
    state: {},
    retryCount: 0,
    abort: () => {
      throw new Error('abort');
    },
  } as never;
}

function stateArgs(context: RequestContext, overrides: Record<string, unknown> = {}) {
  return {
    ...(inputArgs(context, []) as unknown as Record<string, unknown>),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    activeStateSignals: [],
    contextWindow: { hasSnapshot: false },
    deltasSinceSnapshot: [],
    ...overrides,
  } as never;
}

describe('FactoryPhaseStateProcessor', () => {
  it('ingests completed tool results once using binding, message, and tool-call identity', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    await prepare(storage);
    const onResult = vi.fn(() => undefined);
    const rules = defaultFactoryRules({ version: 'rules-v1', overrides: { tools: { submit_plan: { onResult } } } });
    const processor = new FactoryPhaseStateProcessor({ rules, storage });
    const args = inputArgs(requestContext(), [toolMessage()]);

    await processor.processInputStep(args);
    rules.version = 'rules-v2';
    await processor.processInputStep(args);

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleSetVersion: 'rules-v1',
        toolName: 'submit_plan',
        assistantMessageId: 'assistant-1',
        toolCallId: 'tool-call-1',
        result: { status: 'success', value: { approved: true } },
      }),
    );
  });

  it('runs the durable terminal tool observer before rule reconciliation', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    await prepare(storage);
    const recordPullRequestProvenance = vi.fn(async () => undefined);
    const processor = new FactoryPhaseStateProcessor({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
      recordPullRequestProvenance,
    });

    await processor.processInputStep(
      inputArgs(requestContext(), [
        toolMessage({
          toolName: 'execute_command',
          args: { command: 'gh pr create --title test' },
          result: { stdout: 'https://github.com/acme/repo/pull/17' },
        }),
      ]),
    );

    expect(recordPullRequestProvenance).toHaveBeenCalledWith(
      expect.objectContaining({
        assistantMessageId: 'assistant-1',
        toolCallId: 'tool-call-1',
        toolName: 'execute_command',
        toolInput: { command: 'gh pr create --title test' },
        status: 'success',
      }),
    );
  });

  it('continues authoritative tool-result ingress when provenance recording fails', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    await prepare(storage);
    const onResult = vi.fn(() => undefined);
    const processor = new FactoryPhaseStateProcessor({
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: { tools: { execute_command: { onResult } } },
      }),
      storage,
      recordPullRequestProvenance: vi.fn(async () => {
        throw new Error('GitHub unavailable');
      }),
    });

    await expect(
      processor.processInputStep(
        inputArgs(requestContext(), [
          toolMessage({
            toolName: 'execute_command',
            args: { command: 'gh pr create --title test' },
            result: { stdout: 'https://github.com/acme/repo/pull/17' },
          }),
        ]),
      ),
    ).resolves.toBeUndefined();

    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('moves an approved plan to Building before emitting the next phase signal', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const prepared = await prepare(storage, 'plan');
    const rules = defaultFactoryRules({ version: 'rules-v1' });
    const transitionService = new FactoryTransitionService({ rules, storage });
    const processor = new FactoryPhaseStateProcessor({ rules, storage, transitionService });

    await processor.processInputStep(
      inputArgs(requestContext(), [
        toolMessage({ result: { content: 'Plan approved. Proceed with implementation.' } }),
      ]),
    );

    await expect(storage.get({ orgId: 'org-1', id: prepared.item.id })).resolves.toMatchObject({
      revision: 2,
      stages: ['execute'],
    });
    const signal = await processor.computeStateSignal(stateArgs(requestContext()));
    expect(signal).toMatchObject({
      attributes: { board: 'work', stage: 'execute', role: 'plan', revision: 2 },
    });
    expect(signal?.contents).toContain('Factory work phase: Building (execute)');
  });

  it('uses completed step results to avoid reconciling unrelated historical messages', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    await prepare(storage);
    const onResult = vi.fn(() => undefined);
    const rules = defaultFactoryRules({ version: 'rules-v1', overrides: { tools: { submit_plan: { onResult } } } });
    const processor = new FactoryPhaseStateProcessor({ rules, storage });
    const args = inputArgs(requestContext(), [
      toolMessage({ id: 'historical', toolCallId: 'historical-call' }),
      toolMessage({ id: 'current', toolCallId: 'tool-call-1' }),
    ]);

    await processor.processInputStep(args);

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ assistantMessageId: 'current' }));
  });

  it('binds continuation ingress to the newest assistant message when tool-call IDs repeat', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    await prepare(storage);
    const onResult = vi.fn(() => undefined);
    const rules = defaultFactoryRules({ version: 'rules-v1', overrides: { tools: { submit_plan: { onResult } } } });
    const processor = new FactoryPhaseStateProcessor({ rules, storage });

    await processor.processInputStep(
      inputArgs(requestContext(), [
        toolMessage({ id: 'older-assistant', toolCallId: 'tool-call-1' }),
        toolMessage({ id: 'current-assistant', toolCallId: 'tool-call-1' }),
      ]),
    );

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ assistantMessageId: 'current-assistant' }));
  });

  it('normalizes errors and persists rule decisions before returning', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    await prepare(storage);
    const onResult = vi.fn(context => {
      expect(context.result).toEqual({ status: 'error', value: { message: 'approval failed' } });
      return {
        type: 'notify' as const,
        title: 'Plan failed',
        body: 'Inspect the plan result.',
        level: 'warning' as const,
        idempotencyKey: 'notify-plan-failure',
      };
    });
    const rules = defaultFactoryRules({ version: 'rules-v1', overrides: { tools: { submit_plan: { onResult } } } });
    const processor = new FactoryPhaseStateProcessor({ rules, storage });

    await processor.processInputStep(
      inputArgs(requestContext(), [toolMessage({ state: 'error', result: new Error('approval failed') })]),
    );

    expect(onResult).toHaveBeenCalledTimes(1);
    await expect(storage.listDeferredDecisions('org-1', PROJECT_ID)).resolves.toEqual([
      expect.objectContaining({ idempotencyKey: 'notify-plan-failure', status: 'pending' }),
    ]);
  });

  it('records invalid rule output as a typed rule error without enqueuing an effect', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const prepared = await prepare(storage);
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        tools: {
          submit_plan: {
            onResult: () =>
              ({
                type: 'notify',
                idempotencyKey: 'invalid-effect',
                title: 'Invalid',
                arbitraryUrl: 'https://secret.test',
              }) as never,
          },
        },
      },
    });
    const processor = new FactoryPhaseStateProcessor({ rules, storage });

    await processor.processInputStep(inputArgs(requestContext(), [toolMessage()]));

    const identity = JSON.stringify([prepared.binding.id, 'thread-1', 'assistant-1', 'tool-call-1']);
    await expect(storage.getTransitionResultByIngress('org-1', PROJECT_ID, identity)).resolves.toMatchObject({
      status: 'rejected',
      code: 'rule_error',
    });
    await expect(storage.listDeferredDecisions('org-1', PROJECT_ID)).resolves.toEqual([]);
  });

  it('commits a tool-result transition before the immediately following phase signal', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    await prepare(storage);
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        tools: {
          submit_plan: {
            onResult: () => ({
              type: 'transition',
              board: 'work',
              stage: 'execute',
              idempotencyKey: 'approved-plan-transition',
            }),
          },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ rules, storage });
    const processor = new FactoryPhaseStateProcessor({ rules, storage, transitionService });
    const context = requestContext();

    await processor.processInputStep(inputArgs(context, [toolMessage()]));
    const signal = await processor.computeStateSignal(stateArgs(context));

    expect(signal).toMatchObject({ attributes: { stage: 'execute', revision: 2 } });
    expect(signal?.contents).toContain('Factory work phase: Building (execute)');
  });

  it('does nothing for sessions that were never Factory-bound', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const rules = defaultFactoryRules({ version: 'rules-v1' });
    const processor = new FactoryPhaseStateProcessor({ rules, storage });

    await expect(processor.processInputStep(inputArgs(requestContext(), [toolMessage()]))).resolves.toBeUndefined();
    await expect(processor.computeStateSignal(stateArgs(requestContext()))).resolves.toBeUndefined();
  });

  it('emits phase state for a server-started bound turn without an authenticated user context', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    await prepare(storage);
    const rules = defaultFactoryRules({ version: 'rules-v1' });
    const processor = new FactoryPhaseStateProcessor({ rules, storage });

    const signal = await processor.computeStateSignal(stateArgs(requestContext({ authenticated: false })));

    expect(signal).toMatchObject({ attributes: { status: 'active', board: 'work', stage: 'planning', role: 'work' } });
    expect(signal?.contents).toContain('Revision: 1');
  });

  it('emits, suppresses, re-emits after compaction, and retracts a revoked phase snapshot', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const prepared = await prepare(storage);
    const rules = defaultFactoryRules({ version: 'rules-v1' });
    const processor = new FactoryPhaseStateProcessor({ rules, storage });
    const context = requestContext();
    const first = await processor.computeStateSignal(stateArgs(context));
    expect(first).toMatchObject({ id: 'factory-phase', mode: 'snapshot', attributes: { status: 'active' } });
    expect(first?.contents).toContain('expectedRevision 1');

    const lastSnapshot = { metadata: { value: first?.metadata?.value } };
    await expect(
      processor.computeStateSignal(
        stateArgs(context, {
          contextWindow: { hasSnapshot: true },
          lastSnapshot,
          tracking: { currentCacheKey: first?.cacheKey },
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      processor.computeStateSignal(
        stateArgs(context, {
          contextWindow: { hasSnapshot: false },
          lastSnapshot,
          tracking: { currentCacheKey: first?.cacheKey },
        }),
      ),
    ).resolves.toMatchObject({ cacheKey: first?.cacheKey, mode: 'snapshot' });

    await storage.revokeRunBinding({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      bindingId: prepared.binding.id,
      revokedAt: new Date(),
    });
    await expect(
      processor.computeStateSignal(
        stateArgs(context, {
          contextWindow: { hasSnapshot: false },
          lastSnapshot,
          tracking: { currentCacheKey: first?.cacheKey },
        }),
      ),
    ).resolves.toBeUndefined();
    const retraction = await processor.computeStateSignal(
      stateArgs(context, {
        contextWindow: { hasSnapshot: true },
        lastSnapshot,
        tracking: { currentCacheKey: first?.cacheKey },
      }),
    );
    expect(retraction).toMatchObject({
      cacheKey: `factory:none:${prepared.binding.id}`,
      mode: 'snapshot',
      contents: '\n',
      attributes: { status: 'none' },
      metadata: { value: { phase: { status: 'none' } } },
    });
    expect(JSON.stringify(retraction)).not.toContain('Improve the settings UI');
  });

  it('preserves the cacheable phase history and appends an empty snapshot on revocation', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const prepared = await prepare(storage);
    const rules = defaultFactoryRules({ version: 'rules-v1' });
    const processor = new FactoryPhaseStateProcessor({ rules, storage });
    const context = requestContext();
    const active = await processor.computeStateSignal(stateArgs(context));
    const activeSignal = createSignal({
      id: 'active-factory-phase',
      type: 'state',
      tagName: 'factory-phase',
      contents: String(active?.contents),
      metadata: {
        ...active?.metadata,
        state: {
          id: 'factory-phase',
          threadId: 'thread-1',
          cacheKey: active?.cacheKey,
          mode: 'snapshot',
          version: 1,
        },
      },
    });
    const messageList = new MessageList();
    messageList.add(activeSignal.toDBMessage(), 'memory');
    await storage.revokeRunBinding({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      bindingId: prepared.binding.id,
      revokedAt: new Date(),
    });

    await expect(
      processor.processInputStep({
        ...(inputArgs(context, []) as unknown as Record<string, unknown>),
        messages: messageList.get.all.db(),
        messageList,
        steps: [],
      } as never),
    ).resolves.toBeUndefined();
    expect(messageList.get.all.db().map(message => message.id)).toContain('active-factory-phase');

    const retraction = await processor.computeStateSignal(
      stateArgs(context, {
        activeStateSignals: [activeSignal],
        contextWindow: { hasSnapshot: true },
        lastSnapshot: activeSignal,
        tracking: { currentCacheKey: active?.cacheKey },
      }),
    );
    expect(retraction).toMatchObject({ mode: 'snapshot', attributes: { status: 'none' } });
    messageList.addSignal(
      createSignal({
        id: 'empty-factory-phase',
        type: 'state',
        tagName: 'factory-phase',
        contents: String(retraction?.contents),
        metadata: {
          ...retraction?.metadata,
          state: {
            id: 'factory-phase',
            threadId: 'thread-1',
            cacheKey: retraction?.cacheKey,
            mode: 'snapshot',
            version: 2,
          },
        },
      }),
    );

    const prompt = JSON.stringify(messageList.get.all.aiV5.prompt());
    expect(prompt).toContain('Improve the settings UI');
    expect(prompt).toContain('Factory work phase');
    expect(messageList.get.all.db().map(message => message.id)).toEqual([
      'active-factory-phase',
      'empty-factory-phase',
    ]);
  });

  it('emits a full snapshot when an active binding follows an in-window empty snapshot', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    await prepare(storage);
    const rules = defaultFactoryRules({ version: 'rules-v1' });
    const processor = new FactoryPhaseStateProcessor({ rules, storage });
    const emptySnapshot = { metadata: { value: { phase: { status: 'none' } } } };

    const signal = await processor.computeStateSignal(
      stateArgs(requestContext(), {
        activeStateSignals: [emptySnapshot],
        contextWindow: { hasSnapshot: true },
        lastSnapshot: emptySnapshot,
        tracking: { currentCacheKey: 'factory:none:revoked' },
      }),
    );

    expect(signal).toMatchObject({ mode: 'snapshot', attributes: { status: 'active' } });
  });

  it('re-emits when the exact bound role changes', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const prepared = await prepare(storage);
    const rules = defaultFactoryRules({ version: 'rules-v1' });
    const processor = new FactoryPhaseStateProcessor({ rules, storage });
    const context = requestContext();
    const first = await processor.computeStateSignal(stateArgs(context));
    await storage.revokeRunBinding({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      bindingId: prepared.binding.id,
      revokedAt: new Date(),
    });
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: prepared.item.id,
        input: {
          externalSource: prepared.item.externalSource,
          title: prepared.item.title,
          stages: prepared.item.stages,
          sessions: prepared.item.sessions,
          metadata: prepared.item.metadata,
        },
      },
      role: 'plan',
      session: { projectPath: '/worktree', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: 'resource-1',
      kickoffKey: 'kickoff-role-change',
      kickoffMessage: null,
    });

    const changed = await processor.computeStateSignal(
      stateArgs(context, {
        contextWindow: { hasSnapshot: true },
        lastSnapshot: { metadata: { value: first?.metadata?.value } },
        tracking: { currentCacheKey: first?.cacheKey },
      }),
    );
    expect(changed).toMatchObject({
      mode: 'delta',
      attributes: { role: 'plan' },
      delta: { phase: { role: 'plan' } },
    });
    expect(changed?.cacheKey).not.toBe(first?.cacheKey);
  });

  it('bounds linked summaries and changes the cache key with revision and rule version', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const prepared = await prepare(storage);
    for (let index = 0; index < 7; index += 1) {
      await storage.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        input: {
          externalSource: {
            integrationId: 'github',
            type: 'pull-request',
            externalId: `github-pr:${index}`,
          },
          parentWorkItemId: prepared.item.id,
          title: `Review ${index}`,
          stages: ['intake'],
          sessions: {},
          metadata: {},
        },
      });
    }
    const rules = defaultFactoryRules({ version: 'rules-v1' });
    const processor = new FactoryPhaseStateProcessor({ rules, storage });
    const first = await processor.computeStateSignal(stateArgs(requestContext()));
    expect(String(first?.contents).match(/github-pr Review/g)).toHaveLength(5);

    rules.version = 'rules-v2';
    const versionChanged = await processor.computeStateSignal(
      stateArgs(requestContext(), {
        contextWindow: { hasSnapshot: true },
        lastSnapshot: { metadata: { value: first?.metadata?.value } },
        tracking: { currentCacheKey: first?.cacheKey },
      }),
    );
    expect(versionChanged?.cacheKey).not.toBe(first?.cacheKey);
  });

  it('revisits the inclusive cursor when a suspended invocation later resumes with a result', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    await prepare(storage);
    const onResult = vi.fn(() => undefined);
    const rules = defaultFactoryRules({ version: 'rules-v1', overrides: { tools: { submit_plan: { onResult } } } });
    const createdAt = new Date('2026-07-18T10:00:00Z');
    let resumed = false;
    const reader = {
      listMessages: vi.fn(async () => ({
        messages: [
          toolMessage({
            id: 'assistant-suspended',
            toolCallId: 'suspended-call',
            state: resumed ? 'result' : 'call',
            createdAt,
          }),
        ],
        hasMore: false,
      })),
    };
    const processor = new FactoryPhaseStateProcessor({ rules, storage, messageReader: reader as never });

    await processor.reconcileAllBoundThreads();
    expect(onResult).not.toHaveBeenCalled();
    resumed = true;
    await processor.reconcileAllBoundThreads();

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(reader.listMessages).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: { dateRange: { start: createdAt } } }),
    );
  });

  it('reconciles paginated terminal results from a durable cursor across restart retries', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const prepared = await prepare(storage);
    const onResult = vi.fn(() => undefined);
    const pages = [
      { messages: [toolMessage({ id: 'assistant-terminal', toolCallId: 'terminal-call' })], hasMore: true },
      {
        messages: [
          toolMessage({
            id: 'assistant-aborted',
            toolCallId: 'aborted-call',
            state: 'error',
            result: 'aborted',
            createdAt: new Date('2026-07-18T10:01:00Z'),
          }),
        ],
        hasMore: false,
      },
    ];
    const reader = { listMessages: vi.fn(async ({ page }: { page: number }) => pages[page]!) };
    const rules = defaultFactoryRules({ version: 'rules-v1', overrides: { tools: { submit_plan: { onResult } } } });
    const processor = new FactoryPhaseStateProcessor({ rules, storage, messageReader: reader as never });

    await processor.reconcileAllBoundThreads();
    const restarted = new FactoryPhaseStateProcessor({ rules, storage, messageReader: reader as never });
    await restarted.reconcileAllBoundThreads();

    expect(onResult).toHaveBeenCalledTimes(2);
    expect(reader.listMessages).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, perPage: 50, orderBy: { field: 'createdAt', direction: 'ASC' } }),
    );
    expect(reader.listMessages).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: { dateRange: { start: new Date('2026-07-18T10:01:00Z') } } }),
    );
    await expect(storage.getToolResultCursor('org-1', PROJECT_ID, prepared.binding.id)).resolves.toMatchObject({
      lastMessageId: 'assistant-aborted',
    });
  });
});
