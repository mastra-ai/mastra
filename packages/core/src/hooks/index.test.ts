import { vi, it, expect } from 'vitest';

import { AvailableHooks, deregisterHook, executeHook, registerHook } from './index';

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

it('should stop firing a hook after it is deregistered', async () => {
  const hook = vi.fn();

  registerHook(AvailableHooks.ON_SCORER_RUN, hook);
  deregisterHook(AvailableHooks.ON_SCORER_RUN, hook);
  executeHook(AvailableHooks.ON_SCORER_RUN, hookBody as any);

  await new Promise(resolve => setTimeout(resolve, 0));

  expect(hook).not.toHaveBeenCalled();
});

it('should only deregister the given handler, leaving others intact', async () => {
  const kept = vi.fn();
  const dropped = vi.fn();

  registerHook(AvailableHooks.ON_SCORER_RUN, kept);
  registerHook(AvailableHooks.ON_SCORER_RUN, dropped);
  deregisterHook(AvailableHooks.ON_SCORER_RUN, dropped);
  executeHook(AvailableHooks.ON_SCORER_RUN, hookBody as any);

  await new Promise(resolve => setTimeout(resolve, 0));

  expect(dropped).not.toHaveBeenCalled();
  expect(kept).toHaveBeenCalledWith(hookBody);

  deregisterHook(AvailableHooks.ON_SCORER_RUN, kept);
});
