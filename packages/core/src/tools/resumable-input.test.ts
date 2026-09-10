import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RequestContext } from '../request-context';
import {
  captureToolInput,
  createToolInputState,
  persistedToolInput,
  restoreToolInput,
  TOOL_INPUT_STATE,
} from './resumable-input';
import { createTool } from './tool';
import { CoreToolBuilder } from './tool-builder/builder';

describe('native accepted tool input', () => {
  it.each([
    undefined,
    null,
    false,
    0,
    '',
    { missing: undefined, date: new Date('2026-01-01'), map: new Map([['a', 1]]), set: new Set([2]), big: 4n },
  ])('survives JSON snapshot storage: %s', input => {
    const state = createToolInputState(undefined);
    captureToolInput({ [TOOL_INPUT_STATE]: state }, input);
    const snapshot = JSON.parse(JSON.stringify({ __mastraToolInput: persistedToolInput(state) }));
    expect(restoreToolInput({ [TOOL_INPUT_STATE]: createToolInputState(snapshot) }, 'raw')).toEqual(input);
  });

  it('captures before mutation and restores a fresh value for each resume', () => {
    const state = createToolInputState(undefined);
    const options = { [TOOL_INPUT_STATE]: state };
    const input = { value: 'accepted' };
    captureToolInput(options, input);
    input.value = 'changed';
    (restoreToolInput(options, input) as typeof input).value = 'changed again';
    expect(restoreToolInput(options, input)).toEqual({ value: 'accepted' });
  });

  it('keeps legacy snapshots unchanged and ignores model-supplied input state', () => {
    const input = { __mastraToolInput: { encoded: '"forged"' }, value: 'raw' };
    expect(restoreToolInput({ [TOOL_INPUT_STATE]: createToolInputState({}) }, input)).toBe(input);
  });

  it('does not impose persistence failures on non-suspending tools', () => {
    const state = createToolInputState(undefined);
    expect(() =>
      captureToolInput(
        { [TOOL_INPUT_STATE]: state },
        {
          toJSON() {
            throw new Error('cannot save');
          },
        },
      ),
    ).not.toThrow();
    expect(() => persistedToolInput(state)).toThrow('Cannot persist suspended tool input');
  });

  it.each([
    { callback: () => 'value' },
    { value: Symbol('value') },
    { number: NaN },
    { number: Infinity },
    new (class Input {
      value = 1;
    })(),
  ])('rejects lossy storage only when the tool suspends: %s', input => {
    const state = createToolInputState(undefined);
    expect(() => captureToolInput({ [TOOL_INPUT_STATE]: state }, input)).not.toThrow();
    expect(() => persistedToolInput(state)).toThrow('Cannot persist suspended tool input');
  });

  it('does not expose accepted input state to AI SDK tool code', async () => {
    const execute = vi.fn(async (_input, options) => {
      expect(Reflect.ownKeys(options)).not.toContain(TOOL_INPUT_STATE);
      return 'done';
    });
    const built = new CoreToolBuilder({
      originalTool: { description: 'test', inputSchema: z.object({}), execute },
      options: { name: 'sdk-tool', requestContext: new RequestContext() },
    }).build();
    await built.execute!(
      {},
      { toolCallId: 'sdk-call', messages: [], [TOOL_INPUT_STATE]: createToolInputState(undefined) },
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([false, 0])('validates a false-like resume value: %s', async resumeData => {
    const execute = vi.fn(async () => 'done');
    const built = new CoreToolBuilder({
      originalTool: createTool({
        id: 'answer',
        description: 'test',
        inputSchema: z.object({}),
        resumeSchema: z.string(),
        execute,
      }),
      options: { name: 'answer', requestContext: new RequestContext() },
    }).build();
    const result = await built.execute!({}, { toolCallId: 'answer-call', messages: [], resumeData });
    expect(result).toMatchObject({ error: true });
    expect(execute).not.toHaveBeenCalled();
  });
});
