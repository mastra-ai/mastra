import { Text } from '@earendil-works/pi-tui';
import type { PluginManager } from '@mastra/code-sdk/plugins/manager';
import type { PiExtensionGeneration } from '@mastra/code-sdk/plugins/pi/types';
import type { PiUiHost, PiUiNotificationLevel } from '@mastra/code-sdk/plugins/pi/ui-adapter';

import { showError, showInfo } from '../display.js';
import { askModalQuestion } from '../modal-question.js';
import type { TUIState } from '../state.js';
import { theme } from '../theme.js';

function widgetText(content: unknown): string | undefined {
  if (content === undefined || content === null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content) && content.every(line => typeof line === 'string')) return content.join('\n');
  if (typeof content === 'object' && 'text' in content && typeof content.text === 'string') return content.text;
  return undefined;
}

function promptWithSignal(
  state: TUIState,
  signal: AbortSignal,
  options: Parameters<typeof askModalQuestion>[1],
): Promise<string | null> {
  if (signal.aborted) return Promise.resolve(null);
  return askModalQuestion(state.ui, { ...options, signal });
}

export class PiTuiBridge implements PiUiHost {
  readonly #statuses = new Map<string, { generation: PiExtensionGeneration; key: string; text: string }>();
  readonly #widgets = new Map<string, { generation: PiExtensionGeneration; key: string; text: string }>();
  readonly #diagnosed = new Set<string>();
  #removeReconcileListener: (() => void) | undefined;

  constructor(
    private readonly state: TUIState,
    private readonly manager: PluginManager,
  ) {}

  async start(): Promise<void> {
    await this.manager.setPiUiHost(this);
    await this.#reconcile(this.manager.getPiGenerations());
    this.#removeReconcileListener = this.manager.onPiGenerationsReconcile(generations => this.#reconcile(generations));
  }

  async stop(): Promise<void> {
    this.#removeReconcileListener?.();
    this.#removeReconcileListener = undefined;
    await this.manager.setPiUiHost(undefined);
    this.#statuses.clear();
    this.#widgets.clear();
    this.#diagnosed.clear();
    this.#renderSlots();
  }

  notify(generation: PiExtensionGeneration, message: string, level: PiUiNotificationLevel): void {
    generation.assertActive();
    const text = `[${generation.extensionId}] ${message}`;
    if (level === 'error') showError(this.state, text);
    else showInfo(this.state, level === 'warning' ? `Warning: ${text}` : text);
  }

  setStatus(generation: PiExtensionGeneration, key: string, text: string | undefined): void {
    generation.assertActive();
    const id = `${generation.id}:${key}`;
    const ownedCount = [...this.#statuses.values()].filter(status => status.generation === generation).length;
    if (text && !this.#statuses.has(id) && ownedCount >= 8) {
      this.#diagnoseOnce(
        generation,
        'ui:setStatus:slot-limit',
        `Pi extension "${generation.extensionId}" exceeded the eight-slot Mastra Code status limit.`,
      );
      return;
    }
    if (text) this.#statuses.set(id, { generation, key, text: text.slice(0, 500) });
    else this.#statuses.delete(id);
    this.#renderSlots();
  }

  setWidget(generation: PiExtensionGeneration, key: string, content: unknown): boolean {
    generation.assertActive();
    const text = widgetText(content);
    if (text === undefined) return false;
    const id = `${generation.id}:${key}`;
    const ownedCount = [...this.#widgets.values()].filter(widget => widget.generation === generation).length;
    if (text && !this.#widgets.has(id) && ownedCount >= 8) {
      this.#diagnoseOnce(
        generation,
        'ui:setWidget:slot-limit',
        `Pi extension "${generation.extensionId}" exceeded the eight-slot Mastra Code widget limit.`,
      );
      return false;
    }
    if (text) this.#widgets.set(id, { generation, key, text: text.slice(0, 2_000) });
    else this.#widgets.delete(id);
    this.#renderSlots();
    return true;
  }

  async select(
    generation: PiExtensionGeneration,
    title: string,
    options: readonly string[],
    signal: AbortSignal,
  ): Promise<string | undefined> {
    generation.assertActive();
    const value = await promptWithSignal(this.state, signal, {
      question: title,
      options: options.map(label => ({ label })),
      allowCustomResponse: false,
    });
    return value ?? undefined;
  }

  async confirm(
    generation: PiExtensionGeneration,
    title: string,
    message: string,
    signal: AbortSignal,
  ): Promise<boolean> {
    generation.assertActive();
    const value = await promptWithSignal(this.state, signal, {
      question: `${title}\n${message}`,
      options: [{ label: 'Yes' }, { label: 'No' }],
      allowCustomResponse: false,
    });
    return value === 'Yes';
  }

  async input(
    generation: PiExtensionGeneration,
    title: string,
    placeholder: string | undefined,
    signal: AbortSignal,
  ): Promise<string | undefined> {
    generation.assertActive();
    const value = await promptWithSignal(this.state, signal, {
      question: title,
      defaultValue: placeholder,
      allowCustomResponse: true,
      allowEmptyInput: true,
    });
    return value ?? undefined;
  }

  async editor(
    generation: PiExtensionGeneration,
    title: string,
    initialValue: string | undefined,
    signal: AbortSignal,
  ): Promise<string | undefined> {
    generation.assertActive();
    const value = await promptWithSignal(this.state, signal, {
      question: title,
      defaultValue: initialValue,
      allowCustomResponse: true,
      allowEmptyInput: true,
      multiline: true,
      overlay: { widthPercent: 80, maxHeight: '80%' },
    });
    return value ?? undefined;
  }

  getTheme(): Readonly<Record<string, string>> {
    const colors = theme.getTheme();
    return Object.freeze({
      accent: colors.accent,
      text: colors.text,
      muted: colors.muted,
      dim: colors.dim,
      error: colors.error,
      warning: colors.warning,
      success: colors.success,
      border: colors.border,
    });
  }

  getEditorText(): string {
    return this.state.editor.getText();
  }

  setEditorText(text: string): void {
    this.state.editor.setText(text);
    this.state.ui.requestRender();
  }

  clearGeneration(generation: PiExtensionGeneration): void {
    for (const [id, status] of this.#statuses) {
      if (status.generation === generation) this.#statuses.delete(id);
    }
    for (const [id, widget] of this.#widgets) {
      if (widget.generation === generation) this.#widgets.delete(id);
    }
    for (const id of this.#diagnosed) {
      if (id.startsWith(`${generation.id}:`)) this.#diagnosed.delete(id);
    }
    this.#renderSlots();
  }

  async #reconcile(generations: readonly PiExtensionGeneration[]): Promise<void> {
    const active = new Set(generations);
    for (const status of this.#statuses.values()) {
      if (!active.has(status.generation)) this.clearGeneration(status.generation);
    }
    for (const widget of this.#widgets.values()) {
      if (!active.has(widget.generation)) this.clearGeneration(widget.generation);
    }
    for (const generation of generations) {
      for (const shortcut of generation.registrations.shortcuts.keys()) {
        generation.recordCapability('registerShortcut');
        this.#diagnoseOnce(
          generation,
          `registerShortcut:${shortcut}`,
          `Pi shortcut "${shortcut}" is not installed because Mastra Code reserves terminal key handling to the active UI.`,
          'registerShortcut',
        );
      }
    }
  }

  #diagnoseOnce(generation: PiExtensionGeneration, key: string, message: string, capability = key): void {
    const id = `${generation.id}:${key}`;
    if (this.#diagnosed.has(id)) return;
    this.#diagnosed.add(id);
    generation.addDiagnostic('warning', message, capability);
    this.notify(generation, message, 'warning');
    this.setWidget(generation, `diagnostic:${key}`, `Compatibility warning: ${message}`);
  }

  #renderSlots(): void {
    const statuses = [...this.#statuses.values()]
      .sort((a, b) => `${a.generation.extensionId}:${a.key}`.localeCompare(`${b.generation.extensionId}:${b.key}`))
      .map(status => `${status.generation.extensionId}: ${status.text}`);
    this.state.piUiStatusLine?.setText(statuses.length > 0 ? theme.fg('muted', statuses.join(' · ')) : '');

    this.state.piUiWidgets?.clear();
    for (const widget of [...this.#widgets.values()].sort((a, b) =>
      `${a.generation.extensionId}:${a.key}`.localeCompare(`${b.generation.extensionId}:${b.key}`),
    )) {
      this.state.piUiWidgets?.addChild(
        new Text(theme.fg('muted', `[${widget.generation.extensionId}] ${widget.text}`), 1, 0),
      );
    }
    this.state.ui.requestRender();
  }
}
