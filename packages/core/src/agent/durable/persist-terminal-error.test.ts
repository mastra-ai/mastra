import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Memory } from '../../../../memory/src';
import { InMemoryStore } from '../../storage';
import { MessageList } from '../message-list';
import { persistTerminalError } from './persist-terminal-error';

let memory: Memory;
const state = { threadId: 'failed-thread', resourceId: 'owner' };
const failure = new Error('The task failed.');
beforeEach(async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
  memory = new Memory({ storage: new InMemoryStore(), options: { semanticRecall: false, generateTitle: false } });
  await memory.createThread({ threadId: state.threadId, resourceId: state.resourceId });
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

function save(overrides: Partial<Parameters<typeof persistTerminalError>[0]> = {}) {
  return persistTerminalError({ agentId: 'agent', runId: 'run', memory, state, error: failure, ...overrides });
}

it('retains one framework record after repeated delivery without adding model prose', async () => {
  await save();
  await save();
  const { messages } = await memory.recall({ threadId: state.threadId, resourceId: state.resourceId, perPage: false });
  expect(messages).toHaveLength(1);
  expect(messages[0]?.content.metadata).toEqual({ runId: 'run', stopReason: 'error', errorMessage: failure.message });
  expect(messages[0]?.content.parts).toEqual([{ type: 'data-error', data: { message: failure.message } }]);
  const prompt = new MessageList().add(messages, 'memory').get.all.aiV5.prompt();
  expect(JSON.stringify(prompt)).not.toContain(failure.message);
});

it.each(['readOnly', 'no-memory', 'no-thread'] as const)('honors %s memory policy', async policy => {
  const write = vi.spyOn(memory, 'saveMessages');
  await save({
    memory: policy === 'no-memory' ? undefined : memory,
    state:
      policy === 'no-thread'
        ? undefined
        : {
            ...state,
            memoryConfig: { readOnly: policy === 'readOnly' },
          },
  });
  expect(write).not.toHaveBeenCalled();
});

it('retains framework failure data when observational memory owns response persistence', async () => {
  await save({ state: { ...state, observationalMemory: true } });
  const { messages } = await memory.recall({ threadId: state.threadId, resourceId: state.resourceId, perPage: false });
  expect(messages).toHaveLength(1);
  expect(messages[0]?.content.parts).toEqual([{ type: 'data-error', data: { message: failure.message } }]);
});

it('honors the configured readOnly default', async () => {
  memory = new Memory({ storage: new InMemoryStore(), options: { readOnly: true } });
  const write = vi.spyOn(memory, 'saveMessages');
  await save();
  expect(write).not.toHaveBeenCalled();
});

it('rejects another resource without saving into its thread', async () => {
  const write = vi.spyOn(memory, 'saveMessages');
  await expect(save({ state: { ...state, resourceId: 'other' } })).rejects.toThrow('owned thread');
  expect(write).not.toHaveBeenCalled();
});

it('does not create a missing thread to hide an identity mismatch', async () => {
  const create = vi.spyOn(memory, 'createThread');
  await expect(save({ state: { ...state, threadId: 'missing' } })).rejects.toThrow('owned thread');
  expect(create).not.toHaveBeenCalled();
});

it('rejects an empty save acknowledgment', async () => {
  vi.spyOn(memory, 'saveMessages').mockResolvedValue({ messages: [] });
  await expect(save()).rejects.toThrow('did not retain');
});

it('propagates a storage failure without retrying', async () => {
  const write = vi.spyOn(memory, 'saveMessages').mockRejectedValue(new Error('Storage unavailable'));
  await expect(save()).rejects.toThrow('Storage unavailable');
  expect(write).toHaveBeenCalledTimes(1);
});

it('uses distinct records for different runs', async () => {
  await save();
  await save({ runId: 'second-run' });
  const { messages } = await memory.recall({ threadId: state.threadId, resourceId: state.resourceId, perPage: false });
  expect(new Set(messages.map(row => row.id)).size).toBe(2);
});
