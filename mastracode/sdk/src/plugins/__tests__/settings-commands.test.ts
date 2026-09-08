import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { MastraCodePluginSession } from '../../plugin.js';
import { createInteractiveBindingHost } from '../interactive-binding.js';
import { collectSettingsCommands, openSettingsCommand, validateSettingsCommands } from '../settings-commands.js';
import type {
  LoadedPluginSettingsCommand,
  PluginInteractiveBinding,
  PluginSettingsCommand,
} from '../settings-commands.js';

const session = {} as MastraCodePluginSession;
const identity = { session, sessionId: 's', resourceId: 'r', threadId: 't' };
function fixture() {
  const lifecycle = new AbortController();
  const binding = new AbortController();
  const save = vi.fn(async () => {});
  const command: PluginSettingsCommand = {
    label: 'Settings',
    fields: {
      enabled: { type: 'boolean', label: 'Enabled' },
      policy: { type: 'select', label: 'Policy', options: [{ label: 'Skip', value: 'skip' }] },
    },
    schema: z.object({ enabled: z.boolean(), policy: z.string() }),
    resolve: () => ({ values: { enabled: false, policy: 'skip' }, status: [{ label: 'State', value: 'Paused' }] }),
    save,
  };
  const entry: LoadedPluginSettingsCommand = {
    pluginId: 'fixture',
    name: 'settings',
    command,
    signal: lifecycle.signal,
  };
  return {
    command,
    entry,
    save,
    lifecycle,
    binding,
    form: openSettingsCommand(entry, { ...identity, signal: binding.signal }),
  };
}

describe('settings commands', () => {
  it('validates definitions and preserves a complete snapshot', async () => {
    const { command, form, save } = fixture();
    expect(validateSettingsCommands({ settings: command }).settings.fields).toEqual(command.fields);
    expect(await form.resolve()).toMatchObject({
      success: true,
      value: { values: { enabled: false, policy: 'skip' } },
    });
    expect(await form.save({ enabled: true, policy: 'skip' })).toEqual({ success: true, value: undefined });
    expect(save).toHaveBeenCalledWith({ enabled: true, policy: 'skip' }, expect.objectContaining(identity));
  });
  it.each(['bad/name', 'UpperCase', ''])('rejects command name %s', name => {
    expect(() => validateSettingsCommands({ [name]: fixture().command })).toThrow();
  });
  it('rejects unsupported controls and duplicate options', () => {
    const { command } = fixture();
    expect(() =>
      validateSettingsCommands({ settings: { ...command, fields: { x: { type: 'script', label: 'X' } } } }),
    ).toThrow();
    expect(() =>
      validateSettingsCommands({
        settings: {
          ...command,
          fields: {
            x: {
              type: 'select',
              label: 'X',
              options: [
                { label: 'A', value: 'a' },
                { label: 'B', value: 'a' },
              ],
            },
          },
        },
      }),
    ).toThrow();
  });
  it.each([
    { enabled: true },
    { enabled: 'true', policy: 'skip' },
    { enabled: true, policy: 'wake' },
    { enabled: true, policy: 'skip', extra: 'x' },
  ])('rejects incomplete or mismatched values %j', async values => {
    const { form, save } = fixture();
    expect(await form.save(values)).toMatchObject({ success: false });
    expect(save).not.toHaveBeenCalled();
  });
  it('rejects schema/value key mismatches even when schema supplies defaults', async () => {
    const { command, form, save } = fixture();
    command.schema = z.object({ different: z.string().default('value') });
    expect(await form.resolve()).toMatchObject({ success: false });
    expect(await form.save({ enabled: true, policy: 'skip' })).toMatchObject({ success: false });
    expect(save).not.toHaveBeenCalled();
  });
  it('surfaces persistence and resolver errors', async () => {
    const { command, form, save } = fixture();
    save.mockRejectedValueOnce(new Error('disk full'));
    expect(await form.save({ enabled: true, policy: 'skip' })).toEqual({ success: false, error: 'disk full' });
    command.resolve = () => {
      throw new Error('corrupt record');
    };
    expect(await form.resolve()).toEqual({ success: false, error: 'corrupt record' });
  });
  it.each(['lifecycle', 'binding'] as const)('prevents save after %s cancellation', async key => {
    const f = fixture();
    f[key].abort();
    expect(await f.form.save({ enabled: true, policy: 'skip' })).toMatchObject({ success: false });
    expect(f.save).not.toHaveBeenCalled();
  });
  it('checks cancellation after async schema validation before persistence', async () => {
    const { command, binding, form, save } = fixture();
    command.schema = z.object({ enabled: z.boolean(), policy: z.string() }).superRefine(async () => {
      binding.abort();
    });
    expect(await form.save({ enabled: true, policy: 'skip' })).toMatchObject({ success: false });
    expect(save).not.toHaveBeenCalled();
  });
  it('rejects all duplicates and built-in/Markdown collisions, preserving unrelated commands', () => {
    const { entry } = fixture();
    const result = collectSettingsCommands(
      [
        entry,
        { ...entry, pluginId: 'second' },
        { ...entry, name: 'help' },
        { ...entry, name: 'markdown' },
        { ...entry, name: 'unique' },
      ],
      ['help', 'markdown'],
    );
    expect(result.commands.map(entry => entry.name)).toEqual(['unique']);
    expect(result.diagnostics).toHaveLength(4);
  });
});

describe('interactive binding host', () => {
  it('delivers current state synchronously, then first binding, replacement and shutdown', () => {
    const host = createInteractiveBindingHost(vi.fn());
    const received: (PluginInteractiveBinding | undefined)[] = [];
    const stop = host.onInteractiveBindingChange(binding => received.push(binding));
    expect(received).toEqual([undefined]);
    host.publish(identity);
    const first = host.getInteractiveBinding()!;
    host.publish({ ...identity, threadId: 'next' });
    expect(first.signal.aborted).toBe(true);
    host.publish(undefined);
    expect(received.map(value => value?.threadId)).toEqual([undefined, 't', 'next', undefined]);
    expect(received[2]!.signal.aborted).toBe(true);
    stop();
    host.publish(identity);
    expect(received).toHaveLength(4);
  });
  it('isolates thrown listeners and honors self-unsubscription', () => {
    const errors = vi.fn();
    const host = createInteractiveBindingHost(errors);
    host.onInteractiveBindingChange(() => {
      throw new Error('plugin failure');
    });
    const seen = vi.fn();
    const unsubscribe = host.onInteractiveBindingChange(binding => {
      seen(binding);
      if (binding) unsubscribe();
    });
    host.publish(identity);
    host.publish(undefined);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(errors).toHaveBeenCalledTimes(3);
  });
  it('coalesces reentrant transitions without delivering obsolete generations', () => {
    const host = createInteractiveBindingHost(vi.fn());
    const seen: string[] = [];
    host.onInteractiveBindingChange(binding => {
      if (binding?.threadId === 't') {
        host.publish({ ...identity, threadId: 'discarded' });
        host.publish({ ...identity, threadId: 'latest' });
      }
    });
    host.onInteractiveBindingChange(binding => {
      if (binding) seen.push(binding.threadId);
    });
    host.publish(identity);
    expect(seen).toEqual(['latest']);
  });
  it('keeps a newer binding published by an abort handler', () => {
    const host = createInteractiveBindingHost(vi.fn());
    host.publish(identity);
    host
      .getInteractiveBinding()!
      .signal.addEventListener('abort', () => host.publish({ ...identity, threadId: 'newest' }));
    host.publish({ ...identity, threadId: 'intermediate' });
    expect(host.getInteractiveBinding()?.threadId).toBe('newest');
    expect(host.getInteractiveBinding()?.signal.aborted).toBe(false);
  });
  it('invalidates a same-session resource rebind', () => {
    const host = createInteractiveBindingHost(vi.fn());
    host.publish(identity);
    const old = host.getInteractiveBinding()!;
    host.publish({ ...identity, resourceId: 'other' });
    expect(old.signal.aborted).toBe(true);
    expect(host.getInteractiveBinding()?.resourceId).toBe('other');
  });
});
