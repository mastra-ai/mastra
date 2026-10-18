import { describe, expect, it, vi } from 'vitest';

import { executeToolCall } from './execute-tool-core';

function run(execute: () => unknown, onOutput?: (params: { output: unknown }) => void) {
  return executeToolCall({
    tool: { execute, ...(onOutput ? { onOutput } : {}) },
    args: {},
    toolOptions: {},
    toolCallId: 'call-1',
    toolName: 'notify',
  });
}

describe('executeToolCall', () => {
  // The mapping steps read `result === undefined` as "not executed / awaiting a
  // client result", so an executed tool that returns nothing must not produce it.
  it('records an executed tool that returns undefined as a null result', async () => {
    const onOutput = vi.fn();

    const outcome = await run(async () => undefined, onOutput);

    expect(outcome).toEqual({ status: 'success', result: null, rawResult: undefined });
    expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ output: null }));
  });

  it('passes defined results through unchanged', async () => {
    const value = { sent: true };

    expect(await run(async () => value)).toEqual({ status: 'success', result: value, rawResult: value });
    expect(await run(async () => null)).toEqual({ status: 'success', result: null, rawResult: null });
    expect(await run(async () => 0)).toEqual({ status: 'success', result: 0, rawResult: 0 });
  });
});
