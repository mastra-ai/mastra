import { afterEach, expect, it, vi } from 'vitest';
import { runAcpServer } from './server.js';
import { acpMain } from './index.js';

vi.mock('./server.js', () => ({ runAcpServer: vi.fn() }));
vi.mock('./runtime.js', () => ({ createAcpSession: vi.fn() }));
vi.mock('./event-mapper.js', () => ({ setAutoApprove: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

it('terminates on a fatal server failure rather than waiting for stdin to close', async () => {
  const originalLog = console.log;
  const failure = new Error('Transport setup failed');
  const exited = new Error('process.exit');
  vi.mocked(runAcpServer).mockRejectedValueOnce(failure);
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw exited;
  });
  const oldExitCode = process.exitCode;
  try {
    await expect(acpMain()).rejects.toBe(exited);
    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Transport setup failed'));
    expect(console.log).toBe(originalLog);
  } finally {
    process.exitCode = oldExitCode;
  }
});
