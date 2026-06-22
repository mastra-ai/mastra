import { describe, expect, it } from 'vitest';

import { resolveShellPassthroughCompletion } from '../shell-result';

describe('resolveShellPassthroughCompletion', () => {
  it('uses the process exit code when one exists', () => {
    expect(resolveShellPassthroughCompletion({ failed: true, exitCode: 127 })).toEqual({ exitCode: 127 });
  });

  it('does not report spawn failures or timeouts as success when no exit code exists', () => {
    expect(
      resolveShellPassthroughCompletion({
        failed: true,
        exitCode: undefined,
        shortMessage: 'Command failed with ENOENT',
      }),
    ).toEqual({ exitCode: 1, diagnostic: 'Command failed with ENOENT' });
  });

  it('falls back to success only for non-failed results without an exit code', () => {
    expect(resolveShellPassthroughCompletion({ failed: false, exitCode: undefined })).toEqual({ exitCode: 0 });
  });

  it('prefers the execa failure reason over buffered stderr that was already streamed', () => {
    expect(
      resolveShellPassthroughCompletion({
        failed: true,
        exitCode: undefined,
        stderr: 'already streamed stderr',
        shortMessage: 'Command timed out after 30000 milliseconds',
      }),
    ).toEqual({ exitCode: 1, diagnostic: 'Command timed out after 30000 milliseconds' });
  });
});
