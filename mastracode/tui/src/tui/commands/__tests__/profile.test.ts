import type { ProcessMemoryDiagnosticsStatus } from '@mastra/code-sdk/process-memory-diagnostics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleProfileCommand } from '../profile.js';

function createStatus(
  state: ProcessMemoryDiagnosticsStatus['state'] = 'inactive',
  overrides: Partial<ProcessMemoryDiagnosticsStatus> = {},
): ProcessMemoryDiagnosticsStatus {
  return {
    state,
    outputDirectory: state === 'active' ? '/tmp/profiles/run-1' : null,
    config: {
      parentDirectory: '/tmp/profiles',
      sampleIntervalMs: 10_000,
      captureIntervalMs: 300_000,
      allocationIntervalBytes: 524_288,
    },
    sampleCount: 0,
    captureCount: 0,
    gcEventCount: 0,
    latestSample: null,
    latestCapturePath: null,
    error: null,
    ...overrides,
  };
}

function createCtx(initialStatus = createStatus()) {
  let status = initialStatus;
  const diagnostics = {
    getStatus: vi.fn(() => status),
    start: vi.fn(async () => {
      status = createStatus('active');
      return status;
    }),
    capture: vi.fn(async () => ({
      path: '/tmp/profiles/run-1/allocation-000001.heapprofile',
      sequence: 1,
      timestamp: '2026-08-17T09:00:00.000Z',
      reason: 'manual' as const,
    })),
    stop: vi.fn(async () => {
      status = createStatus('inactive', { outputDirectory: '/tmp/profiles/run-1', captureCount: 2 });
      return status;
    }),
  };
  return {
    diagnostics,
    ctx: {
      processMemoryDiagnostics: diagnostics,
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleProfileCommand', () => {
  it.each([{ args: [] }, { args: ['status'] }])('shows inactive status for $args', async ({ args }) => {
    const { ctx } = createCtx();

    await handleProfileCommand(ctx, args);

    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Process memory diagnostics: inactive'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Latest sample: none'));
  });

  it('shows active status with artifact counts and the latest process sample', async () => {
    const status = createStatus('active', {
      sampleCount: 3,
      captureCount: 2,
      gcEventCount: 1,
      latestSample: {
        timestamp: '2026-08-17T09:00:00.000Z',
        sequence: 3,
        elapsedMs: 20_000,
        memory: {
          rss: 100 * 1024 ** 2,
          heapTotal: 50,
          heapUsed: 40 * 1024 ** 2,
          external: 5 * 1024 ** 2,
          arrayBuffers: 2 * 1024 ** 2,
        },
        resourceUsage: {} as never,
        heap: {} as never,
        heapSpaces: [],
      },
    });
    const { ctx } = createCtx(status);

    await handleProfileCommand(ctx);

    const output = ctx.showInfo.mock.calls[0][0];
    expect(output).toContain('Output directory: /tmp/profiles/run-1');
    expect(output).toContain('Allocation captures: 2');
    expect(output).toContain('RSS: 100.0 MiB');
    expect(output).toContain('JS heap used: 40.0 MiB');
  });

  it('starts diagnostics and warns that local allocation artifacts are sensitive', async () => {
    const { ctx, diagnostics } = createCtx();

    await handleProfileCommand(ctx, ['start']);

    expect(diagnostics.start).toHaveBeenCalledOnce();
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Artifacts: /tmp/profiles/run-1'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('may contain prompts, credentials'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('overhead'));
  });

  it('keeps the original run when start is requested while active', async () => {
    const { ctx, diagnostics } = createCtx(createStatus('active'));

    await handleProfileCommand(ctx, ['start']);

    expect(diagnostics.start).not.toHaveBeenCalled();
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('already active'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('/tmp/profiles/run-1'));
  });

  it('captures an allocation profile without claiming to force GC', async () => {
    const { ctx, diagnostics } = createCtx(createStatus('active'));

    await handleProfileCommand(ctx, ['capture']);

    expect(diagnostics.capture).toHaveBeenCalledWith('manual');
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('allocation-000001.heapprofile'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('does not force GC'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('sensitive application data'));
  });

  it('rejects capture while inactive', async () => {
    const { ctx, diagnostics } = createCtx();

    await handleProfileCommand(ctx, ['capture']);

    expect(diagnostics.capture).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith('Process memory diagnostics are not active. Use /profile start first.');
  });

  it('stops diagnostics and reports the durable run directory', async () => {
    const { ctx, diagnostics } = createCtx(createStatus('active'));

    await handleProfileCommand(ctx, ['stop']);

    expect(diagnostics.stop).toHaveBeenCalledOnce();
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Process memory diagnostics stopped.'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('/tmp/profiles/run-1'));
  });

  it('treats duplicate stop as an inactive status response', async () => {
    const { ctx, diagnostics } = createCtx();

    await handleProfileCommand(ctx, ['stop']);

    expect(diagnostics.stop).not.toHaveBeenCalled();
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('already inactive'));
  });

  it.each([{ args: ['bogus'] }, { args: ['status', 'extra'] }])('rejects invalid arguments $args', async ({ args }) => {
    const { ctx, diagnostics } = createCtx();

    await handleProfileCommand(ctx, args);

    expect(ctx.showError).toHaveBeenCalledWith('Usage: /profile [status|start|capture|stop]');
    expect(diagnostics.start).not.toHaveBeenCalled();
  });

  it('renders unavailable and lifecycle errors without throwing', async () => {
    const unavailable = { showInfo: vi.fn(), showError: vi.fn() } as any;
    await handleProfileCommand(unavailable, ['start']);
    expect(unavailable.showError).toHaveBeenCalledWith('Process memory diagnostics are not available in this session.');

    const startFailure = createCtx();
    startFailure.diagnostics.start.mockResolvedValueOnce(
      createStatus('error', { error: 'Unable to connect to the inspector.' }),
    );
    await handleProfileCommand(startFailure.ctx, ['start']);
    expect(startFailure.ctx.showError).toHaveBeenCalledWith(
      'Unable to start process memory diagnostics: Unable to connect to the inspector.',
    );

    const captureFailure = createCtx(createStatus('active'));
    captureFailure.diagnostics.capture.mockRejectedValueOnce(new Error('sampling stopped'));
    await handleProfileCommand(captureFailure.ctx, ['capture']);
    expect(captureFailure.ctx.showError).toHaveBeenCalledWith('Unable to capture allocation profile: sampling stopped');
  });
});
