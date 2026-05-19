import { describe, expect, it, vi } from 'vitest';
import { startWorkspaceSpan } from '../tracing';

function makeContext() {
  const end = vi.fn();
  const createChildSpan = vi.fn(() => ({ end, error: vi.fn() }));
  const context = {
    tracing: {
      currentSpan: { createChildSpan },
    },
  } as any;
  const workspace = { id: 'workspace-1', name: 'Workspace 1' } as any;
  return { end, createChildSpan, context, workspace };
}

describe('startWorkspaceSpan', () => {
  it('redacts env-shaped fields and secret-looking keys from span input and output', () => {
    const { end, createChildSpan, context, workspace } = makeContext();

    const span = startWorkspaceSpan(context, workspace, {
      category: 'sandbox',
      operation: 'executeCommand',
      input: {
        command: 'npm test',
        env: {
          MASTRACODE_TEST_ENV: 'works',
          API_KEY: 'secret-key',
        },
        nested: {
          authorization: 'Bearer secret',
          safe: 'visible',
        },
      },
    });

    span.end(
      { success: true },
      {
        exitCode: 0,
        processEnv: {
          TOKEN: 'secret-token',
        },
        nested: [{ password: 'secret-password', value: 'kept' }],
      },
    );

    expect(createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          command: 'npm test',
          env: {
            redacted: true,
            keys: ['API_KEY', 'MASTRACODE_TEST_ENV'],
          },
          nested: {
            authorization: '[redacted]',
            safe: 'visible',
          },
        },
      }),
    );
    expect(end).toHaveBeenCalledWith({
      output: {
        exitCode: 0,
        processEnv: {
          redacted: true,
          keys: ['TOKEN'],
        },
        nested: [{ password: '[redacted]', value: 'kept' }],
      },
      attributes: { success: true },
    });
  });

  it('normalizes camelCase and uppercase field names before redaction', () => {
    const { createChildSpan, context, workspace } = makeContext();

    startWorkspaceSpan(context, workspace, {
      category: 'sandbox',
      operation: 'executeCommand',
      input: {
        accessToken: 'secret-tok',
        clientSecret: 'secret-val',
        processEnv: { HOME: '/home/user' },
        ENV: { NODE_ENV: 'production' },
        sessionCookie: 'abc123',
        safe: 'visible',
      },
    });

    expect(createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          accessToken: '[redacted]',
          clientSecret: '[redacted]',
          processEnv: { redacted: true, keys: ['HOME'] },
          ENV: { redacted: true, keys: ['NODE_ENV'] },
          sessionCookie: '[redacted]',
          safe: 'visible',
        },
      }),
    );
  });

  it('handles circular references without stack overflow', () => {
    const { createChildSpan, context, workspace } = makeContext();

    const circular: Record<string, unknown> = { value: 'kept' };
    circular.self = circular;

    startWorkspaceSpan(context, workspace, {
      category: 'sandbox',
      operation: 'executeCommand',
      input: circular,
    });

    expect(createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          value: 'kept',
          self: '[redacted:circular]',
        },
      }),
    );
  });

  it('handles circular references in arrays', () => {
    const { createChildSpan, context, workspace } = makeContext();

    const obj: Record<string, unknown> = { name: 'test' };
    const arr = [obj];
    obj.items = arr;

    startWorkspaceSpan(context, workspace, {
      category: 'sandbox',
      operation: 'executeCommand',
      input: { data: arr },
    });

    expect(createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          data: [{ name: 'test', items: '[redacted:circular]' }],
        },
      }),
    );
  });

  it('preserves repeated non-cyclic object references', () => {
    const { createChildSpan, context, workspace } = makeContext();

    const shared = { value: 'kept' };

    startWorkspaceSpan(context, workspace, {
      category: 'sandbox',
      operation: 'executeCommand',
      input: { first: shared, second: shared },
    });

    expect(createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          first: { value: 'kept' },
          second: { value: 'kept' },
        },
      }),
    );
  });

  it('preserves repeated non-cyclic array references', () => {
    const { createChildSpan, context, workspace } = makeContext();

    const shared = ['kept'];

    startWorkspaceSpan(context, workspace, {
      category: 'sandbox',
      operation: 'executeCommand',
      input: { first: shared, second: shared },
    });

    expect(createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          first: ['kept'],
          second: ['kept'],
        },
      }),
    );
  });
});
