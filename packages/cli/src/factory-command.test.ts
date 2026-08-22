import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import { configureFactoryCreateCommand, type FactoryCreateOptions } from './commands/factory/command';

function quiet(command: Command): Command {
  return command.exitOverride().configureOutput({
    writeOut: () => {},
    writeErr: () => {},
  });
}

async function parseNamespaced(args: string[], action = vi.fn()) {
  const program = quiet(new Command().name('mastra'));
  const factory = program.command('factory');
  configureFactoryCreateCommand(factory.command('create')).action(action);
  await program.parseAsync(['node', 'mastra', 'factory', 'create', ...args]);
  return action;
}

describe('Factory create command registration', () => {
  it('registers the Factory-owned command API under mastra factory create', async () => {
    const action = await parseNamespaced(['my-factory', '--no-platform', '--template', 'acme/template']);
    const call = action.mock.calls[0] as [string, FactoryCreateOptions];

    expect(call[0]).toBe('my-factory');
    expect(call[1]).toMatchObject({ platform: false, template: 'acme/template' });
  });

  it('does not register the unreleased init command', () => {
    const factory = new Command().command('factory');
    configureFactoryCreateCommand(factory.command('create'));

    expect(factory.commands.map(command => command.name())).toEqual(['create']);
  });
});
