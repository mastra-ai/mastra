import { describe, expect, it, vi } from 'vitest';
import { startWorkspaceSpan } from '../tracing';

describe('startWorkspaceSpan', () => {
  it('redacts env-shaped fields and secret-looking keys from span input and output', () => {
    const end = vi.fn();
    const createChildSpan = vi.fn(() => ({ end, error: vi.fn() }));
    const context = {
      tracing: {
        currentSpan: { createChildSpan },
      },
    } as any;
    const workspace = { id: 'workspace-1', name: 'Workspace 1' } as any;

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
});
