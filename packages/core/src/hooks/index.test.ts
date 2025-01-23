import { vi, it, expect } from 'vitest';

import { AvailableHooks, executeHook, registerHook } from './index';

it('should be able to capture a hook', async () => {
  const hook = vi.fn();

  registerHook(AvailableHooks.ON_EVALUATION, hook);
  executeHook(AvailableHooks.ON_EVALUATION, {
    input: 'test',
    output: 'test',
    result: {
      score: 1,
    },
  });

  await new Promise(resolve => setTimeout(resolve, 0));

  expect(hook).toHaveBeenCalledWith({
    input: 'test',
    output: 'test',
    result: {
      score: 1,
    },
  });
});

it('should not throw when a hook is not registered', async () => {
  expect(() =>
    executeHook(AvailableHooks.ON_EVALUATION, {
      input: 'test',
      output: 'test',
      result: {
        score: 1,
      },
    }),
  ).not.toThrow();
});

it('should not block the main thread', async () => {
  const hook = vi.fn();

  registerHook(AvailableHooks.ON_EVALUATION, hook);
  executeHook(AvailableHooks.ON_EVALUATION, {
    input: 'test',
    output: 'test',
    result: {
      score: 1,
    },
  });

  expect(hook).not.toHaveBeenCalled();
});
