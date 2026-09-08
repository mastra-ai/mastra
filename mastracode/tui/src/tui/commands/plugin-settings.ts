import { Box, SelectList, Spacer, Text } from '@earendil-works/pi-tui';
import type { Component, OverlayHandle } from '@earendil-works/pi-tui';
import { openSettingsCommand } from '@mastra/code-sdk/plugins/settings-commands';
import type { LoadedPluginSettingsCommand, PluginSettingsSnapshot } from '@mastra/code-sdk/plugins/settings-commands';
import { AskQuestionDialogComponent } from '../components/ask-question-dialog.js';
import { showModalOverlay } from '../overlay.js';
import { syncPluginBinding } from '../plugin-binding.js';
import { getSelectListTheme, theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

const openForms = new WeakMap<SlashCommandContext['state'], () => void>();

export async function handlePluginSettingsCommand(
  ctx: SlashCommandContext,
  entry: LoadedPluginSettingsCommand,
): Promise<void> {
  const { state } = ctx;
  syncPluginBinding(state);
  const binding = state.pluginInteractiveHost?.getInteractiveBinding();
  if (!binding) {
    ctx.showInfo('Open or create a thread before configuring plugin settings.');
    return;
  }
  openForms.get(state)?.();
  const local = new AbortController();
  const form = openSettingsCommand(entry, { ...binding, signal: AbortSignal.any([binding.signal, local.signal]) });
  const signal = form.context.signal;
  let overlay: OverlayHandle | undefined;
  let snapshot: PluginSettingsSnapshot;
  let busy = false;
  let error = '';
  const close = () => {
    signal.removeEventListener('abort', close);
    overlay?.hide();
    if (openForms.get(state) === close) openForms.delete(state);
    local.abort();
  };
  openForms.set(state, close);
  signal.addEventListener('abort', close, { once: true });
  const alive = () => {
    syncPluginBinding(state);
    return !signal.aborted;
  };
  const show = (component: Component) => {
    if (!alive()) return;
    overlay?.hide();
    overlay = showModalOverlay(state.ui, component);
  };
  const save = async () => {
    if (busy || !alive()) return;
    busy = true;
    error = '';
    render();
    const result = await form.save({ ...snapshot.values });
    if (!alive()) return;
    if (!result.success) error = result.error;
    else {
      const refreshed = await form.resolve();
      if (!alive()) return;
      if (refreshed.success) snapshot = refreshed.value;
      else error = refreshed.error;
    }
    busy = false;
    render(result.success && !error ? 'Saved' : undefined);
  };
  const edit = (key: string) => {
    if (busy || !alive()) return;
    const field = entry.command.fields[key]!;
    if (field.type === 'boolean') {
      snapshot.values[key] = !snapshot.values[key];
      render();
    } else if (field.type === 'select') {
      const box = new Box(4, 2, text => theme.bg('overlayBg', text));
      box.addChild(new Text(field.label, 0, 0));
      const list = new SelectList(
        field.options.map(option => ({ ...option })),
        Math.min(12, field.options.length),
        getSelectListTheme(),
      );
      list.onSelect = item => {
        if (!alive()) return;
        snapshot.values[key] = item.value;
        render();
      };
      list.onCancel = close;
      box.addChild(list);
      show(Object.assign(box, { handleInput: (data: string) => list.handleInput(data) }));
    } else {
      show(
        new AskQuestionDialogComponent({
          question: field.label,
          defaultValue: String(snapshot.values[key]),
          allowEmptyInput: true,
          tui: state.ui,
          onSubmit: value => {
            if (!alive()) return;
            snapshot.values[key] = value;
            render();
          },
          onCancel: close,
        }),
      );
    }
  };
  const render = (notice?: string) => {
    if (!alive()) return;
    const box = new Box(4, 2, text => theme.bg('overlayBg', text));
    box.addChild(new Text(theme.bold(entry.command.label), 0, 0));
    box.addChild(new Text(`Thread: ${binding.threadId}`, 0, 0));
    if (entry.command.description) box.addChild(new Text(entry.command.description, 0, 0));
    for (const row of snapshot.status ?? []) box.addChild(new Text(`${row.label}: ${row.value}`, 0, 0));
    box.addChild(new Spacer(1));
    if (error) box.addChild(new Text(theme.fg('error', error), 0, 0));
    if (notice) box.addChild(new Text(theme.fg('success', notice), 0, 0));
    const items = Object.entries(entry.command.fields).map(([key, field]) => ({
      value: `field:${key}`,
      label: `${field.label}: ${field.type === 'boolean' ? (snapshot.values[key] ? 'On' : 'Off') : field.type === 'select' ? field.options.find(option => option.value === snapshot.values[key])?.label : snapshot.values[key]}`,
      description: field.description,
    }));
    items.push(
      { value: 'save', label: busy ? 'Saving…' : 'Save', description: undefined },
      { value: 'cancel', label: 'Cancel', description: undefined },
    );
    const list = new SelectList(items, Math.min(14, items.length), getSelectListTheme());
    list.onSelect = item => {
      if (item.value === 'cancel') close();
      else if (!busy && alive()) {
        if (item.value === 'save') void save();
        else edit(item.value.slice('field:'.length));
      }
    };
    list.onCancel = close;
    box.addChild(list);
    box.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter edit/save · Esc cancel'), 0, 0));
    show(Object.assign(box, { handleInput: (data: string) => list.handleInput(data) }));
  };
  const resolved = await form.resolve();
  if (!alive()) {
    close();
    return;
  }
  if (!resolved.success) {
    close();
    ctx.showError(resolved.error);
    return;
  }
  snapshot = resolved.value;
  render();
}
