import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import { configureFactoryCreateCommand, type FactoryCreateOptions } from './command.js';

function quiet(command: Command): Command {
  return command.exitOverride().configureOutput({
    writeOut: () => {},
    writeErr: () => {},
  });
}

async function parseStandalone(args: string[], action = vi.fn()) {
  const command = configureFactoryCreateCommand(quiet(new Command().name('create-factory')));
  command.action(action);
  await command.parseAsync(['node', 'create-factory', ...args]);
  return action;
}

async function parseSubcommand(args: string[], action = vi.fn()) {
  const program = quiet(new Command().name('mastra'));
  const factory = program.command('factory');
  configureFactoryCreateCommand(factory.command('create')).action(action);
  await program.parseAsync(['node', 'mastra', 'factory', 'create', ...args]);
  return action;
}

describe('shared Factory create Commander wiring', () => {
  it('parses standalone and namespaced arguments identically', async () => {
    const standalone = await parseStandalone(['my-factory', '--no-platform', '--template', 'acme/template']);
    const namespaced = await parseSubcommand(['my-factory', '--no-platform', '--template', 'acme/template']);

    const standaloneCall = standalone.mock.calls[0] as [string, FactoryCreateOptions];
    const namespacedCall = namespaced.mock.calls[0] as [string, FactoryCreateOptions];

    expect(standaloneCall[0]).toBe('my-factory');
    expect(standaloneCall[1]).toMatchObject({ platform: false, template: 'acme/template' });
    expect(namespacedCall[0]).toBe(standaloneCall[0]);
    expect(namespacedCall[1]).toMatchObject({ platform: false, template: 'acme/template' });
  });

  it('uses the built-in scaffold when no custom template is provided', async () => {
    const standalone = await parseStandalone(['my-factory', '--no-platform']);
    const namespaced = await parseSubcommand(['my-factory', '--no-platform']);

    expect(standalone.mock.calls[0]?.[1]).toMatchObject({ platform: false });
    expect(standalone.mock.calls[0]?.[1]).not.toHaveProperty('template');
    expect(namespaced.mock.calls[0]?.[1]).toMatchObject({ platform: false });
    expect(namespaced.mock.calls[0]?.[1]).not.toHaveProperty('template');
  });

  it('forwards platform selection options', async () => {
    const action = await parseSubcommand(['my-factory', '--region', 'us', '--org', 'org_123']);

    expect(action.mock.calls[0]?.[1]).toMatchObject({ region: 'us', org: 'org_123' });
  });

  it('does not register the unreleased init command', () => {
    const factory = new Command().command('factory');
    configureFactoryCreateCommand(factory.command('create'));

    expect(factory.commands.map(command => command.name())).toEqual(['create']);
  });
});
