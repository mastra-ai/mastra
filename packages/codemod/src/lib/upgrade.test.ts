import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { upgradeV1 } from './upgrade';

const { transformMock } = vi.hoisted(() => ({
  transformMock: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: () => ({ start: vi.fn(), message: vi.fn(), stop: vi.fn() }),
}));

vi.mock('debug', () => ({
  default: () => vi.fn(),
}));

vi.mock('./bundle', () => ({
  BUNDLE: ['v1/first', 'v1/second'],
}));

vi.mock('./transform', () => ({
  transform: transformMock,
}));

describe('upgradeV1', () => {
  beforeEach(() => {
    process.exitCode = undefined;
    transformMock.mockReset();
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it('runs every codemod and sets a failing exit code when any transform reports errors', async () => {
    transformMock
      .mockResolvedValueOnce({
        errors: [{ transform: 'v1/first', filename: '/project/input.ts', summary: 'transform failed' }],
        notImplementedErrors: [],
      })
      .mockResolvedValueOnce({ errors: [], notImplementedErrors: [] });

    await upgradeV1({});

    expect(transformMock).toHaveBeenCalledTimes(2);
    expect(process.exitCode).toBe(1);
  });

  it('leaves the exit code unchanged when every transform succeeds', async () => {
    transformMock.mockResolvedValue({ errors: [], notImplementedErrors: [] });

    await upgradeV1({});

    expect(process.exitCode).toBeUndefined();
  });
});
