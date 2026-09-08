import { createInteractiveBindingHost } from '@mastra/code-sdk/plugins/interactive-binding';
import type { LoadedPluginSettingsCommand } from '@mastra/code-sdk/plugins/settings-commands';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createMockState } from '../../__tests__/agent-controller-mock.js';
import { syncPluginBinding, withPluginBindingTransition } from '../../plugin-binding.js';
import { handlePluginSettingsCommand } from '../plugin-settings.js';

const ui = vi.hoisted(() => ({ overlays: [] as any[], questions: [] as any[], lists: [] as any[] }));
vi.mock('@earendil-works/pi-tui', () => {
  class Box {
    children: any[] = [];
    addChild(child: any) {
      this.children.push(child);
    }
  }
  return {
    Box,
    Text: class {
      constructor(public text: string) {}
    },
    Spacer: class {},
    SelectList: class {
      onSelect?: (item: any) => void;
      onCancel?: () => void;
      constructor(public items: any[]) {
        ui.lists.push(this);
      }
    },
  };
});
vi.mock('../../overlay.js', () => ({
  showModalOverlay: (_tui: any, component: any) => {
    const overlay = { component, hide: vi.fn() };
    ui.overlays.push(overlay);
    return overlay;
  },
}));
vi.mock('../../components/ask-question-dialog.js', () => ({
  AskQuestionDialogComponent: class {
    constructor(public options: any) {
      ui.questions.push(options);
    }
  },
}));
vi.mock('../../theme.js', () => ({
  getSelectListTheme: () => ({}),
  theme: {
    bg: (_name: string, text: string) => text,
    fg: (_name: string, text: string) => text,
    bold: (text: string) => text,
  },
}));

const settle = () => new Promise(resolve => setImmediate(resolve));
function select(value: string) {
  const list = ui.lists.at(-1);
  const item = list.items.find((item: any) => item.value === value);
  expect(item).toBeDefined();
  list.onSelect(item);
}
function screen() {
  return ui.overlays
    .at(-1)
    .component.children?.map((child: any) => child.text ?? '')
    .join('\n');
}
function fixture() {
  const host = createInteractiveBindingHost(error => {
    throw error;
  });
  const state = createMockState({
    threadId: 'original',
    session: { identity: { getId: () => 'session' } },
    extra: {
      isInitialized: true,
      pendingNewThread: false,
      pluginInteractiveHost: host,
      ui: {},
    },
  });
  syncPluginBinding(state as any);
  let values = { enabled: false, cron: 'valid', policy: 'skip' };
  const save = vi.fn(async (next: typeof values) => {
    values = next;
  });
  const lifetime = new AbortController();
  const entry: LoadedPluginSettingsCommand = {
    name: 'heartbeat',
    pluginId: 'test',
    signal: lifetime.signal,
    command: {
      label: 'Heartbeat',
      fields: {
        enabled: { type: 'boolean', label: 'Enabled' },
        cron: { type: 'string', label: 'Cron' },
        policy: {
          type: 'select',
          label: 'Policy',
          options: [
            { value: 'skip', label: 'Skip' },
            { value: 'send', label: 'Send' },
          ],
        },
      },
      schema: z.object({ enabled: z.boolean(), cron: z.string().min(1), policy: z.enum(['skip', 'send']) }),
      resolve: vi.fn(async () => ({ values: { ...values }, status: [{ label: 'Source', value: 'HEARTBEAT.md' }] })),
      save,
    },
  };
  const ctx = { state, showInfo: vi.fn(), showError: vi.fn() } as any;
  return { ctx, state, host, entry, save, lifetime };
}

beforeEach(() => {
  ui.overlays.length = 0;
  ui.questions.length = 0;
  ui.lists.length = 0;
});
describe('native plugin settings', () => {
  it('edits typed fields locally, saves once and refreshes without chat', async () => {
    const { ctx, state, entry, save } = fixture();
    await handlePluginSettingsCommand(ctx, entry);
    expect(screen()).toContain('Source: HEARTBEAT.md');
    select('field:enabled');
    select('field:cron');
    ui.questions.at(-1).onSubmit('updated');
    select('field:policy');
    expect(ui.lists.at(-1).items.map((i: any) => i.value)).toEqual(['skip', 'send']);
    select('send');
    expect(save).not.toHaveBeenCalled();
    select('save');
    select('save');
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      { enabled: true, cron: 'updated', policy: 'send' },
      expect.objectContaining({ threadId: 'original' }),
    );
    expect(screen()).toContain('Saved');
    expect(state.session.sendMessage).not.toHaveBeenCalled();
    expect(state.session.sendSignal).not.toHaveBeenCalled();
  });

  it('keeps validation and persistence errors open for correction', async () => {
    const { ctx, entry, save } = fixture();
    await handlePluginSettingsCommand(ctx, entry);
    select('field:cron');
    ui.questions.at(-1).onSubmit('');
    select('save');
    await settle();
    expect(save).not.toHaveBeenCalled();
    expect(screen()).toContain('Too small');
    select('field:cron');
    ui.questions.at(-1).onSubmit('valid');
    save.mockRejectedValueOnce(new Error('disk full'));
    select('save');
    await settle();
    expect(screen()).toContain('disk full');
    select('save');
    await settle();
    expect(screen()).toContain('Saved');
  });

  it.each(['cancel', 'escape', 'field-escape'])('discards unsaved values on %s', async mode => {
    const { ctx, entry, save } = fixture();
    await handlePluginSettingsCommand(ctx, entry);
    select('field:enabled');
    if (mode === 'cancel') select('cancel');
    else if (mode === 'escape') ui.lists.at(-1).onCancel();
    else {
      select('field:cron');
      ui.questions.at(-1).onCancel();
    }
    expect(ui.overlays.at(-1).hide).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    await handlePluginSettingsCommand(ctx, entry);
    expect(ui.lists.at(-1).items[0].label).toBe('Enabled: Off');
  });

  it.each(['binding', 'reload', 'shutdown'])('cancels pending resolution on %s', async reason => {
    const { ctx, entry, host, lifetime, save } = fixture();
    const pending = Promise.withResolvers<any>();
    entry.command.resolve = () => pending.promise;
    const opening = handlePluginSettingsCommand(ctx, entry);
    if (reason === 'reload') lifetime.abort();
    else host.publish(undefined);
    pending.resolve({ values: { enabled: false, cron: 'valid', policy: 'skip' } });
    await opening;
    expect(ui.overlays).toHaveLength(0);
    expect(save).not.toHaveBeenCalled();
  });

  it('closes during disable while saving and never paints stale success', async () => {
    const { ctx, entry, lifetime, save } = fixture();
    const pending = Promise.withResolvers<void>();
    save.mockImplementation(async (_values, context?: any) => {
      await pending.promise;
      context?.signal.throwIfAborted();
    });
    await handlePluginSettingsCommand(ctx, entry);
    select('save');
    await settle();
    const count = ui.overlays.length;
    lifetime.abort();
    pending.resolve();
    await settle();
    expect(ui.overlays.at(-1).hide).toHaveBeenCalled();
    expect(ui.overlays).toHaveLength(count);
  });

  it('withdraws before async switching, closes the form and pins the original context', async () => {
    const { ctx, state, host, entry, save } = fixture();
    await handlePluginSettingsCommand(ctx, entry);
    const original = host.getInteractiveBinding()!;
    await withPluginBindingTransition(state as any, async () => {
      expect(original.signal.aborted).toBe(true);
      expect(host.getInteractiveBinding()).toBeUndefined();
      await state.session.thread.switch({ threadId: 'other' });
      syncPluginBinding(state as any);
      expect(host.getInteractiveBinding()).toBeUndefined();
    });
    expect(host.getInteractiveBinding()?.threadId).toBe('other');
    select('save');
    await settle();
    expect(save).not.toHaveBeenCalled();
    expect(ui.overlays.at(-1).hide).toHaveBeenCalled();
  });

  it('does not create a thread when unbound and supports an active run', async () => {
    const { ctx, state, entry } = fixture();
    state.pendingNewThread = true;
    await handlePluginSettingsCommand(ctx, entry);
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Open or create a thread'));
    expect(state.session.thread.create).not.toHaveBeenCalled();
    state.pendingNewThread = false;
    state.session.run.isRunning.mockReturnValue(true);
    await handlePluginSettingsCommand(ctx, entry);
    expect(screen()).toContain('Heartbeat');
    expect(state.session.sendSignal).not.toHaveBeenCalled();
  });
});
