import { vi, it, expect } from 'vitest';

import { AvailableHooks, executeHook, registerHook } from './index';

const hookBody = {
  input: 'test',
  output: 'test',
  result: {
    score: 1,
  },
  meta: {},
};

it('should be able to capture a hook', async () => {
  const hook = vi.fn();
  registerHook(AvailableHooks.ON_EVALUATION, hook);
  executeHook(AvailableHooks.ON_EVALUATION, hookBody);

  await new Promise(resolve => setTimeout(resolve, 0));

  expect(hook).toHaveBeenCalledWith(hookBody);
});

it('should not throw when a hook is not registered', async () => {
  expect(() => executeHook(AvailableHooks.ON_EVALUATION, hookBody)).not.toThrow();
});

it('should not block the main thread', async () => {
  const hook = vi.fn();

  registerHook(AvailableHooks.ON_EVALUATION, hook);
  executeHook(AvailableHooks.ON_EVALUATION, hookBody);

  expect(hook).not.toHaveBeenCalled();
});
