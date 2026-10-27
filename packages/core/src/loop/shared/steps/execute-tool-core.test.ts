import { describe, expect, it, vi } from 'vitest';

import { TOOL_ABORT_GRACE_MS } from '../tool-abort-grace';
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
  it.each(['resolve', 'reject'] as const)(
    'settles on abort before a non-cooperative tool can %s',
    async lateOutcome => {
      const controller = new AbortController();
      const execution = Promise.withResolvers<unknown>();
      const release = vi.fn();
      const onOutput = vi.fn();
      const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
      const pending = executeToolCall({
        tool: { execute: () => execution.promise, onOutput },
        args: {},
        toolOptions: {},
        toolCallId: 'call-1',
        toolName: 'notify',
        abortSignal: controller.signal,
        acquireExecution: () => release,
      });
      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      controller.abort();
      try {
        await expect.poll(() => settled, { timeout: 1_000 }).toBe(true);
        await expect(pending).resolves.toEqual({ status: 'aborted' });
        expect(release).toHaveBeenCalledTimes(1);
        expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
        expect(onOutput).not.toHaveBeenCalled();
      } finally {
        if (lateOutcome === 'resolve') execution.resolve({ sent: true });
        else execution.reject(new Error('late tool failure'));
        await pending;
      }
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(release).toHaveBeenCalledTimes(1);
      expect(onOutput).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])('retains a result only inside the cancellation window (inside: %s)', async inside => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const execution = Promise.withResolvers<string>();
    const onOutput = vi.fn();
    const pending = executeToolCall({
      tool: { execute: () => execution.promise, onOutput },
      args: {},
      toolOptions: {},
      toolCallId: 'call-1',
      toolName: 'notify',
      abortSignal: controller.signal,
    });
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    try {
      controller.abort();
      await vi.advanceTimersByTimeAsync(TOOL_ABORT_GRACE_MS - 1);
      expect(settled).toBe(false);
      if (inside) {
        execution.resolve('sent');
        await expect(pending).resolves.toEqual({ status: 'success', result: 'sent', rawResult: 'sent' });
        expect(onOutput).toHaveBeenCalledTimes(1);
      } else {
        await vi.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toEqual({ status: 'aborted' });
        execution.resolve('too late');
        expect(onOutput).not.toHaveBeenCalled();
      }
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      execution.resolve('cleanup');
      vi.useRealTimers();
      await pending;
    }
  });

  it('leaves a failure during the cancellation window incomplete', async () => {
    const controller = new AbortController();
    const onOutput = vi.fn();
    await expect(
      executeToolCall({
        tool: {
          execute: async () => {
            controller.abort();
            throw new Error('cancelled work failed');
          },
          onOutput,
        },
        args: {},
        toolOptions: {},
        toolCallId: 'call-1',
        toolName: 'notify',
        abortSignal: controller.signal,
      }),
    ).resolves.toEqual({ status: 'aborted' });
    expect(onOutput).not.toHaveBeenCalled();
  });

  it('does not execute a tool whose signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(Object.assign(new Error('not an authorization denial'), { name: 'FGADeniedError' }));
    const execute = vi.fn();
    const outcome = await executeToolCall({
      tool: { execute },
      args: {},
      toolOptions: {},
      toolCallId: 'call-1',
      toolName: 'notify',
      abortSignal: controller.signal,
    });
    expect(outcome).toEqual({ status: 'aborted' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('keeps a successful result returned during self-abort', async () => {
    const controller = new AbortController();
    const onOutput = vi.fn();
    const outcome = await executeToolCall({
      tool: {
        execute: () => {
          controller.abort();
          return 'late';
        },
        onOutput,
      },
      args: {},
      toolOptions: {},
      toolCallId: 'call-1',
      toolName: 'notify',
      abortSignal: controller.signal,
    });
    expect(outcome).toEqual({ status: 'success', result: 'late', rawResult: 'late' });
    expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ output: 'late' }));
  });

  it.each(['FGA', 'bailout'])('preserves an immediately rejected %s error after self-abort', async kind => {
    const controller = new AbortController();
    const error = Object.assign(new Error('control flow'), { name: kind === 'FGA' ? 'FGADeniedError' : 'Bailout' });
    await expect(
      executeToolCall({
        tool: {
          execute: async () => {
            controller.abort();
            throw error;
          },
        },
        args: {},
        toolOptions: {},
        toolCallId: 'call-1',
        toolName: 'notify',
        abortSignal: controller.signal,
        assertNotBailedOut: caught => {
          if (caught === error) throw caught;
        },
      }),
    ).rejects.toBe(error);
  });

  it.each(['FGA', 'bailout'])('preserves a synchronous %s error after self-abort', async kind => {
    const controller = new AbortController();
    const error = Object.assign(new Error('control flow'), { name: kind === 'FGA' ? 'FGADeniedError' : 'Bailout' });
    await expect(
      executeToolCall({
        tool: {
          execute: () => {
            controller.abort();
            throw error;
          },
        },
        args: {},
        toolOptions: {},
        toolCallId: 'call-1',
        toolName: 'notify',
        abortSignal: controller.signal,
        assertNotBailedOut: caught => {
          if (caught === error) throw caught;
        },
      }),
    ).rejects.toBe(error);
  });

  it('preserves completed success and removes its abort listener', async () => {
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    const outcome = await executeToolCall({
      tool: { execute: () => 'sent' },
      args: {},
      toolOptions: {},
      toolCallId: 'call-1',
      toolName: 'notify',
      abortSignal: controller.signal,
    });
    controller.abort();
    expect(outcome).toEqual({ status: 'success', result: 'sent', rawResult: 'sent' });
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('preserves synchronous errors, FGA denials, and engine bailouts', async () => {
    const error = new Error('tool failed');
    expect(
      await run(() => {
        throw error;
      }),
    ).toEqual({ status: 'error', error });
    const denied = Object.assign(new Error('denied'), { name: 'FGADeniedError' });
    await expect(
      run(() => {
        throw denied;
      }),
    ).rejects.toBe(denied);
    const controller = new AbortController();
    const bailout = new Error('ownership lost');
    const pending = executeToolCall({
      tool: { execute: () => new Promise(() => {}) },
      args: {},
      toolOptions: {},
      toolCallId: 'call-1',
      toolName: 'notify',
      abortSignal: controller.signal,
      assertNotBailedOut: () => {
        throw bailout;
      },
    });
    controller.abort();
    await expect(pending).rejects.toBe(bailout);
  });

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
