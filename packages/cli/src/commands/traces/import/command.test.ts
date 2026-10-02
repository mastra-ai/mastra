import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import { configureTraceImportCommand, type TraceImportCommandOptions } from './command.js';

function createProgram(action: (provider: string, options: TraceImportCommandOptions) => void): Command {
  const program = new Command()
    .name('mastra')
    .exitOverride()
    .configureOutput({
      writeOut: () => undefined,
      writeErr: () => undefined,
    });
  const traces = program.command('traces').description('Manage observability traces');
  const command = traces.command('import');
  configureTraceImportCommand(command);
  command.action(action);
  return program;
}

describe('trace import command', () => {
  it('forwards the required provider and customer-facing options', async () => {
    const action = vi.fn();
    await createProgram(action).parseAsync([
      'node',
      'mastra',
      'traces',
      'import',
      'langfuse',
      '--project',
      'support',
      '--from',
      '2026-09-01',
      '--to',
      '2026-09-10',
      '--dry-run',
      '--yes',
    ]);

    expect(action).toHaveBeenCalledWith(
      'langfuse',
      expect.objectContaining({
        project: 'support',
        from: '2026-09-01',
        to: '2026-09-10',
        dryRun: true,
        yes: true,
      }),
      expect.any(Command),
    );
  });

  it('requires a source provider', async () => {
    await expect(createProgram(vi.fn()).parseAsync(['node', 'mastra', 'traces', 'import'])).rejects.toMatchObject({
      code: 'commander.missingArgument',
    });
  });

  it('rejects providers that do not have an adapter', async () => {
    await expect(
      createProgram(vi.fn()).parseAsync(['node', 'mastra', 'traces', 'import', 'unknown-provider']),
    ).rejects.toMatchObject({ code: 'commander.invalidArgument' });
  });
});
