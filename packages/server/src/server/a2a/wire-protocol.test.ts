import { describe, expect, it } from 'vitest';
import { getA2AServerCodec, resolveA2AProtocolVersion, toV1Task } from './wire-protocol';

describe('A2A server wire-protocol', () => {
  const task = {
    id: 'task-1',
    contextId: 'context-1',
    status: { state: 'completed', timestamp: '2026-08-06T12:00:00.000Z' },
    history: [
      { messageId: 'm1', role: 'user', parts: [{ kind: 'text', text: 'one' }] },
      { messageId: 'm2', role: 'agent', parts: [{ kind: 'text', text: 'two' }] },
      { messageId: 'm3', role: 'user', parts: [{ kind: 'text', text: 'three' }] },
    ],
  };

  it('returns full history when historyLength is omitted', () => {
    expect(toV1Task(task).history).toHaveLength(3);
  });

  it('returns empty history when historyLength is 0', () => {
    expect(toV1Task(task, { historyLength: 0 }).history).toEqual([]);
  });

  it('returns the last N messages when historyLength is set', () => {
    expect(toV1Task(task, { historyLength: 2 }).history?.map((message: any) => message.messageId)).toEqual([
      'm2',
      'm3',
    ]);
  });

  it('fails closed on unknown task states', () => {
    expect(() => toV1Task({ ...task, status: { state: 'not-a-state' } })).toThrow(/Unsupported A2A task state/);
  });

  it('normalizes 0.3.0 and 1.0.0 version headers', () => {
    expect(resolveA2AProtocolVersion(new Request('http://localhost', { headers: { 'A2A-Version': '0.3.0' } }))).toBe(
      '0.3',
    );
    expect(resolveA2AProtocolVersion(new Request('http://localhost', { headers: { 'A2A-Version': '1.0.0' } }))).toBe(
      '1.0',
    );
  });

  it('encodes GetTask historyLength through the v1 codec', () => {
    const codec = getA2AServerCodec('1.0');
    const encoded = codec.encodeResponse('tasks/get', { jsonrpc: '2.0', id: 1, result: task }, { historyLength: 1 });
    expect(encoded.result.history).toHaveLength(1);
    expect(encoded.result.history[0].messageId).toBe('m3');
  });

  it('encodes ListTasks through the v1 codec without pre-encoding in the executor', () => {
    const codec = getA2AServerCodec('1.0');
    const encoded = codec.encodeResponse(
      'tasks/list',
      {
        jsonrpc: '2.0',
        id: 2,
        result: { tasks: [task], nextPageToken: '', pageSize: 10, totalSize: 1 },
      },
      { includeArtifacts: false, historyLength: 0 },
    );
    expect(encoded.result.tasks[0].status.state).toBe('TASK_STATE_COMPLETED');
    expect(encoded.result.tasks[0].history).toEqual([]);
    expect(encoded.result.tasks[0].artifacts).toBeUndefined();
  });

  it('encodes push bodies through the codec adapters', () => {
    expect(getA2AServerCodec('0.3').encodePushBody(task)).toEqual(task);
    expect(getA2AServerCodec('1.0').encodePushBody(task)).toEqual({ task: expect.objectContaining({ id: 'task-1' }) });
  });
});
