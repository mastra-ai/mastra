import { Part, Message, Task, Artifact, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@mastra/core/a2a';
import { describe, expect, it } from 'vitest';
import type {
  A2AWireArtifact,
  A2AWireMessage,
  A2AWirePart,
  A2AWireTask,
  A2AWireTaskArtifactUpdateEvent,
  A2AWireTaskStatusUpdateEvent,
} from './wire-types';
import { isTextWirePart, isWireArtifactUpdate, isWireMessage, isWireStatusUpdate, isWireTask } from './wire-types';

/**
 * These tests pin Mastra's hand-written v1 wire-JSON types to the SDK's actual
 * `MessageFns` codecs. Mastra works with wire-JSON directly (not the SDK's
 * in-memory protobuf types), so if the SDK ever changes its wire shape these
 * round-trips catch the drift. Each object below is typed as the Mastra wire
 * type and fed through the SDK `fromJSON`, which throws / drops fields if the
 * shape is wrong.
 */
describe('A2A v1 wire types stay compatible with @a2a-js/sdk codecs', () => {
  it('accepts every part variant via Part.fromJSON', () => {
    const parts: A2AWirePart[] = [
      { text: 'hello', mediaType: 'text/plain' },
      { raw: Buffer.from('abc').toString('base64'), filename: 'a.txt', mediaType: 'text/plain' },
      { url: 'https://example.com/f.png', filename: 'f.png', mediaType: 'image/png' },
      { data: { k: 1 } },
    ];
    for (const part of parts) {
      expect(() => Part.fromJSON(part)).not.toThrow();
    }
  });

  it('round-trips a message', () => {
    const message: A2AWireMessage = {
      messageId: 'm1',
      role: 'ROLE_USER',
      parts: [{ text: 'hi' }],
      contextId: 'c1',
    };
    const parsed = Message.fromJSON(message);
    expect(parsed.messageId).toBe('m1');
    expect(Message.toJSON(parsed)).toMatchObject({ messageId: 'm1', role: 'ROLE_USER' });
  });

  it('round-trips a task with a completed status and text artifact', () => {
    const task: A2AWireTask = {
      id: 't1',
      contextId: 'c1',
      status: { state: 'TASK_STATE_COMPLETED', timestamp: '2026-01-01T00:00:00Z' },
      artifacts: [{ artifactId: 'a1', name: 'out', parts: [{ text: 'result' }] }],
    };
    const parsed = Task.fromJSON(task);
    // fromJSON maps the wire state string to the numeric enum internally;
    // toJSON maps it back to the same wire string.
    expect(Task.toJSON(parsed)).toMatchObject({
      id: 't1',
      status: { state: 'TASK_STATE_COMPLETED' },
    });
  });

  it('round-trips an artifact and both update events', () => {
    const artifact: A2AWireArtifact = { artifactId: 'a1', name: 'n', parts: [{ data: { x: 1 } }] };
    expect(() => Artifact.fromJSON(artifact)).not.toThrow();

    const statusEvent: A2AWireTaskStatusUpdateEvent = {
      taskId: 't',
      contextId: 'c',
      status: { state: 'TASK_STATE_WORKING' },
    };
    expect(() => TaskStatusUpdateEvent.fromJSON(statusEvent)).not.toThrow();

    const artifactEvent: A2AWireTaskArtifactUpdateEvent = {
      taskId: 't',
      contextId: 'c',
      artifact,
      append: true,
      lastChunk: false,
    };
    expect(() => TaskArtifactUpdateEvent.fromJSON(artifactEvent)).not.toThrow();
  });

  it('narrows wire events correctly', () => {
    const task: A2AWireTask = { id: 't', contextId: 'c', status: { state: 'TASK_STATE_SUBMITTED' } };
    const message: A2AWireMessage = { messageId: 'm', role: 'ROLE_AGENT', parts: [] };
    const statusEvent: A2AWireTaskStatusUpdateEvent = {
      taskId: 't',
      contextId: 'c',
      status: { state: 'TASK_STATE_WORKING' },
    };
    const artifactEvent: A2AWireTaskArtifactUpdateEvent = {
      taskId: 't',
      contextId: 'c',
      artifact: { artifactId: 'a', parts: [] },
    };

    expect(isWireTask(task)).toBe(true);
    expect(isWireMessage(message)).toBe(true);
    expect(isWireStatusUpdate(statusEvent)).toBe(true);
    expect(isWireArtifactUpdate(artifactEvent)).toBe(true);

    // cross-checks
    expect(isWireTask(statusEvent)).toBe(false);
    expect(isWireStatusUpdate(artifactEvent)).toBe(false);
    expect(isTextWirePart({ text: 'x' })).toBe(true);
    expect(isTextWirePart({ data: {} })).toBe(false);
  });
});
