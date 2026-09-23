import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { actions, transformMock } = vi.hoisted(() => ({
  actions: [] as Array<(...args: unknown[]) => Promise<void>>,
  transformMock: vi.fn(),
}));

vi.mock('commander', () => {
  class MockCommand {
    name() {
      return this;
    }

    description() {
      return this;
    }

    argument() {
      return this;
    }

    option() {
      return this;
    }

    action(callback: (...args: unknown[]) => Promise<void>) {
      actions.push(callback);
      return this;
    }

    command() {
      return new MockCommand();
    }

    parse() {
      return this;
    }
  }

  return { Command: MockCommand };
});

vi.mock('debug', () => ({
  default: Object.assign(() => vi.fn(), { enable: vi.fn() }),
}));

vi.mock('./lib/transform', () => ({
  transform: transformMock,
}));

vi.mock('./lib/upgrade', () => ({
  upgradeV1: vi.fn(),
}));

describe('codemod CLI', () => {
  beforeAll(async () => {
    await import('./index');
  });

  beforeEach(() => {
    process.exitCode = undefined;
    transformMock.mockReset();
  });

  afterAll(() => {
    process.exitCode = undefined;
  });

  it('sets a failing exit code when an individual transform reports errors', async () => {
    transformMock.mockResolvedValue({
      errors: [{ transform: 'v1/runtime-context', filename: '/project/input.ts', summary: 'transform failed' }],
      notImplementedErrors: [],
    });

    await actions[0]!('v1/runtime-context', '/project', {});

    expect(process.exitCode).toBe(1);
  });

  it('leaves the exit code unchanged when an individual transform succeeds', async () => {
    transformMock.mockResolvedValue({ errors: [], notImplementedErrors: [] });

    await actions[0]!('v1/runtime-context', '/project', {});

    expect(process.exitCode).toBeUndefined();
  });
});
