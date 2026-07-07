import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorageMaintenance } from '../../../utils/storage-maintenance.js';
import { handlePruneCommand } from '../prune.js';

function createCtx(maintenance?: Partial<StorageMaintenance> | null) {
  const storageMaintenance =
    maintenance === null
      ? undefined
      : ({
          backend: 'libsql',
          retention: { memory: { messages: { maxAge: '90d' } } },
          prune: vi.fn().mockResolvedValue([]),
          closeStorage: vi.fn().mockResolvedValue(undefined),
          ...maintenance,
        } as StorageMaintenance);
  return {
    state: { options: { storageMaintenance } },
    showInfo: vi.fn(),
    showError: vi.fn(),
    stop: vi.fn(),
    mcpManager: { disconnect: vi.fn().mockResolvedValue(undefined) },
    controller: {
      getMastra: vi.fn().mockReturnValue({ stopWorkers: vi.fn().mockResolvedValue(undefined) }),
      stopIntervals: vi.fn(),
    },
  } as any;
}

describe('handlePruneCommand', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  function loggedOutput(): string {
    return logSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
  }

  it('errors when storage maintenance is unavailable and stays in the TUI', async () => {
    const ctx = createCtx(null);

    await handlePruneCommand(ctx);

    expect(ctx.showError).toHaveBeenCalledWith('Storage maintenance is not available in this session.');
    expect(ctx.stop).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('rejects unknown subcommands and stays in the TUI', async () => {
    const ctx = createCtx();

    await handlePruneCommand(ctx, ['bogus']);

    expect(ctx.showError).toHaveBeenCalledWith('Unknown /prune subcommand: bogus\nUsage: /prune [vacuum]');
    expect(ctx.state.options.storageMaintenance.prune).not.toHaveBeenCalled();
    expect(ctx.stop).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('stops the TUI, quiesces background writers, runs maintenance, and exits 0', async () => {
    const prune = vi.fn().mockResolvedValue([
      { domain: 'memory', table: 'mastra_messages', deleted: 120, done: true },
      { domain: 'observability', table: 'mastra_ai_spans', deleted: 4000, done: true },
    ]);
    const ctx = createCtx({ prune });

    await handlePruneCommand(ctx);

    expect(ctx.stop).toHaveBeenCalledOnce();
    expect(ctx.mcpManager.disconnect).toHaveBeenCalledOnce();
    expect(ctx.controller.getMastra().stopWorkers).toHaveBeenCalledOnce();
    expect(ctx.controller.stopIntervals).toHaveBeenCalledOnce();

    const output = loggedOutput();
    expect(output).toContain('Closing the TUI to run storage maintenance…');
    expect(output).toContain('memory.messages: 90d');
    expect(output).toContain('memory.mastra_messages: 120 rows deleted');
    expect(output).toContain('observability.mastra_ai_spans: 4000 rows deleted');
    expect(output).toContain('Prune complete: 4120 rows deleted.');
    expect(output).toContain('Storage maintenance complete.');
    expect(ctx.state.options.storageMaintenance.closeStorage).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('the TUI stops before the first prune pass runs', async () => {
    const order: string[] = [];
    const ctx = createCtx({
      prune: vi.fn().mockImplementation(async () => {
        order.push('prune');
        return [];
      }),
    });
    ctx.stop.mockImplementation(() => order.push('stop'));

    await handlePruneCommand(ctx);

    expect(order[0]).toBe('stop');
    expect(order).toContain('prune');
  });

  it('vacuum subcommand reclaims disk after closing storage and reports sizes', async () => {
    const reclaimDisk = vi
      .fn()
      .mockResolvedValue([{ file: '/data/mastra.db', bytesBefore: 30 * 1024 ** 3, bytesAfter: 2 * 1024 ** 3 }]);
    const ctx = createCtx({ reclaimDisk });

    await handlePruneCommand(ctx, ['vacuum']);

    expect(reclaimDisk).toHaveBeenCalledOnce();
    const output = loggedOutput();
    expect(output).toContain('/data/mastra.db: 30.0 GB → 2.0 GB');
    expect(output).toContain('Reclaimed 28.0 GB.');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('explains when disk reclamation is unavailable (remote/pg) and still exits 0', async () => {
    const ctx = createCtx({ backend: 'pg' });

    await handlePruneCommand(ctx, ['vacuum']);

    expect(loggedOutput()).toContain('Disk reclamation (VACUUM) is only available for local libsql storage.');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('logs maintenance failures and exits 1', async () => {
    const ctx = createCtx({ prune: vi.fn().mockRejectedValue(new Error('db locked')) });

    await handlePruneCommand(ctx);

    expect(loggedOutput()).toContain('Storage maintenance failed: db locked');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
