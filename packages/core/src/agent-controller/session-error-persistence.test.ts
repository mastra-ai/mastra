import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../agent';
import type { MastraDBMessage } from '../agent/message-list/state/types';
import { InMemoryStore } from '../storage/mock';
import { createMockModel } from '../test-utils/llm-mock';
import { Workspace } from '../workspace';
import { LocalFilesystem } from '../workspace/filesystem/local-filesystem';
import { AgentController } from './agent-controller';
import { Session } from './session';
import { createMockWorkspace } from './test-utils';
import type { SessionErrorData } from './types';

function createController(storage: InMemoryStore) {
  const agent = new Agent({
    id: 'session-error-agent',
    name: 'session-error-agent',
    instructions: 'You are a test agent.',
    model: createMockModel({ mockText: 'ok' }),
  });
  return new AgentController({
    id: 'session-error-controller',
    storage,
    workspace: createMockWorkspace(),
    modes: [{ id: 'build', default: true, agent, defaultModelId: 'openai/gpt-4o' }],
  });
}

function sessionErrorParts(messages: MastraDBMessage[]): SessionErrorData[] {
  return messages.flatMap(message =>
    message.content.parts.flatMap(part => (part.type === 'data-session-error' ? [part.data as SessionErrorData] : [])),
  );
}

describe('session error persistence', () => {
  it('persists one display-only error part and delivers the same occurrence to all listeners', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();
    const session = await controller.createSession({ resourceId: 'resource-1' });
    const first: string[] = [];
    const second: string[] = [];
    session.subscribe(event => {
      if (event.type === 'error' && event.occurrenceId) first.push(event.occurrenceId);
    });
    session.subscribe(event => {
      if (event.type === 'error' && event.occurrenceId) second.push(event.occurrenceId);
    });

    session.emit({ type: 'error', error: new Error('model unavailable'), errorType: 'network', retryable: true });
    await session.finishAgentRun('error');

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);

    const messages = await session.thread.listActiveMessages();
    expect(sessionErrorParts(messages)).toEqual([
      expect.objectContaining({
        occurrenceId: first[0],
        name: 'Error',
        message: 'model unavailable',
        errorType: 'network',
        retryable: true,
      }),
    ]);
    const threadId = session.thread.getId()!;
    expect(
      messages.find(message => message.id === `session-error-${threadId.length}:${threadId}${first[0]}`)?.content.parts,
    ).toHaveLength(1);
  });

  it('persists pre-token and partial-output failures emitted by the run engine', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();
    const session = await controller.createSession({ resourceId: 'resource-1' });

    await (session as any).processStream({
      fullStream: (async function* () {
        yield { type: 'error', payload: { error: new Error('pre-token failure') } };
      })(),
    });
    await (session as any).processStream({
      fullStream: (async function* () {
        yield { type: 'text-start', payload: { id: 'text-1' } };
        yield { type: 'text-delta', payload: { id: 'text-1', text: 'partial output' } };
        yield { type: 'error', payload: { error: new Error('partial-output failure') } };
      })(),
    });

    const messages = await session.thread.listActiveMessages();
    const parts = sessionErrorParts(messages);
    expect(parts).toEqual([
      expect.objectContaining({ name: 'Error', message: 'pre-token failure', occurrenceId: expect.any(String) }),
      expect.objectContaining({ name: 'Error', message: 'partial-output failure', occurrenceId: expect.any(String) }),
    ]);
    const errorMessages = messages.filter(message => message.content.parts[0]?.type === 'data-session-error');
    expect(errorMessages).toHaveLength(2);
    expect(errorMessages.every(message => message.role === 'assistant' && message.content.parts.length === 1)).toBe(
      true,
    );
    expect(errorMessages.every(message => message.createdAt instanceof Date)).toBe(true);
  });

  it('deduplicates a repeated occurrence while retaining separate equal-message failures', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();
    const session = await controller.createSession({ resourceId: 'resource-1' });

    // A transport replay repeats its producer-owned occurrence ID, while each retry gets a new one.
    session.emit({
      type: 'error',
      error: new Error('resume failed'),
      occurrenceId: 'same-occurrence',
      retryAttempt: 1,
    });
    session.emit({
      type: 'error',
      error: new Error('resume failed'),
      occurrenceId: 'same-occurrence',
      retryAttempt: 1,
    });
    session.emit({
      type: 'error',
      error: new Error('resume failed'),
      occurrenceId: 'next-occurrence',
      retryAttempt: 2,
    });
    await session.finishAgentRun('error');

    expect(sessionErrorParts(await session.thread.listActiveMessages())).toEqual([
      expect.objectContaining({ occurrenceId: 'same-occurrence', message: 'resume failed', retryAttempt: 1 }),
      expect.objectContaining({ occurrenceId: 'next-occurrence', message: 'resume failed', retryAttempt: 2 }),
    ]);
  });

  it('persists a resume failure without an active assistant message', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();
    const session = await controller.createSession({ resourceId: 'resource-1' });

    session.run.setRunId({ runId: 'resume-run' });
    session.emit({ type: 'error', error: new Error('resume snapshot missing'), occurrenceId: 'resume-no-message' });
    await session.finishAgentRun('error');

    const messages = await session.thread.listActiveMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: 'assistant',
      content: {
        parts: [
          expect.objectContaining({
            type: 'data-session-error',
            data: expect.objectContaining({ occurrenceId: 'resume-no-message', runId: 'resume-run' }),
          }),
        ],
      },
    });
  });

  it('persists producer-local occurrence IDs independently after a thread switch', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();
    const session = await controller.createSession({ resourceId: 'resource-1' });
    const firstThread = await session.thread.create({ id: 'a:b' });
    session.emit({ type: 'error', error: new Error('first failure'), occurrenceId: 'c' });
    const secondThread = await session.thread.create({ id: 'a' });
    session.emit({ type: 'error', error: new Error('second failure'), occurrenceId: 'b:c' });
    await session.finishAgentRun('error');

    expect(sessionErrorParts(await session.thread.listActiveMessages())).toEqual([
      expect.objectContaining({ occurrenceId: 'b:c', message: 'second failure' }),
    ]);
    await session.thread.switch({ threadId: firstThread.id });
    expect(sessionErrorParts(await session.thread.listActiveMessages())).toEqual([
      expect.objectContaining({ occurrenceId: 'c', message: 'first failure' }),
    ]);
    expect(secondThread.id).toBe('a');
  });

  it('keeps the original error and terminal cleanup when storage rejects the error write', async () => {
    const storage = new InMemoryStore();
    const controller = createController(storage);
    await controller.init();
    const session = await controller.createSession({ resourceId: 'resource-1' });
    const events: string[] = [];
    session.subscribe(event => {
      events.push(event.type);
    });
    const memoryStorage = storage.stores.memory;
    if (!memoryStorage) throw new Error('Expected in-memory storage');
    const saveMessages = vi
      .spyOn(memoryStorage, 'saveMessages')
      .mockRejectedValueOnce(new Error('storage unavailable'));

    session.emit({ type: 'error', error: new Error('model unavailable'), occurrenceId: 'storage-failure' });
    await session.finishAgentRun('error');

    expect(saveMessages).toHaveBeenCalledTimes(1);
    expect(events).toContain('error');
    expect(events).toContain('agent_end');
  });

  it('keeps errors live-only when no storage machinery or thread is available', () => {
    const session = new Session({
      id: 'unbound-session',
      resourceId: 'resource-1',
      ownerId: 'owner-1',
      workspace: new Workspace({ id: 'workspace-1', filesystem: new LocalFilesystem({ basePath: '/tmp' }) }),
    });
    const events: string[] = [];
    session.subscribe(event => {
      events.push(event.type);
    });

    session.emit({ type: 'error', error: new Error('live-only failure'), occurrenceId: 'live-only' });

    expect(events).toContain('error');
  });

  it('persists a workspace failure for the current thread', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();
    const session = await controller.createSession({ resourceId: 'resource-1' });

    session.emit({
      type: 'workspace_error',
      error: new Error('checkout failed'),
      occurrenceId: 'workspace-occurrence',
    });
    await session.finishAgentRun('error');

    expect(sessionErrorParts(await session.thread.listActiveMessages())).toEqual([
      expect.objectContaining({ occurrenceId: 'workspace-occurrence', message: 'Workspace: checkout failed' }),
    ]);
  });
});
