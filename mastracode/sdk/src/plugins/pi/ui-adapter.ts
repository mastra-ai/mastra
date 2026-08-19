import type { PiExtensionGeneration } from './types.js';

export type PiUiNotificationLevel = 'info' | 'warning' | 'error';

export interface PiUiHost {
  notify(generation: PiExtensionGeneration, message: string, level: PiUiNotificationLevel): void;
  setStatus(generation: PiExtensionGeneration, key: string, text: string | undefined): void;
  setWidget(generation: PiExtensionGeneration, key: string, content: unknown, options?: unknown): boolean;
  select(
    generation: PiExtensionGeneration,
    title: string,
    options: readonly string[],
    signal: AbortSignal,
  ): Promise<string | undefined>;
  confirm(generation: PiExtensionGeneration, title: string, message: string, signal: AbortSignal): Promise<boolean>;
  input(
    generation: PiExtensionGeneration,
    title: string,
    placeholder: string | undefined,
    signal: AbortSignal,
  ): Promise<string | undefined>;
  editor(
    generation: PiExtensionGeneration,
    title: string,
    initialValue: string | undefined,
    signal: AbortSignal,
  ): Promise<string | undefined>;
  getTheme(): Readonly<Record<string, string>>;
  getEditorText(): string;
  setEditorText(text: string): void;
  clearGeneration(generation: PiExtensionGeneration): void | Promise<void>;
}

export interface PiExtensionUiContext {
  select(title: string, options: readonly string[], optionsArg?: unknown): Promise<string | undefined>;
  confirm(title: string, message: string, optionsArg?: unknown): Promise<boolean>;
  input(title: string, placeholder?: string, optionsArg?: unknown): Promise<string | undefined>;
  editor(title: string, initialValue?: string, optionsArg?: unknown): Promise<string | undefined>;
  notify(message: string, level?: PiUiNotificationLevel): void;
  setStatus(key: string, text?: string): void;
  setWorkingMessage(message?: string): void;
  setWidget(key: string, content?: unknown, options?: unknown): void;
  getTheme(): Readonly<Record<string, string>>;
  setTheme(theme: unknown): boolean;
  getEditorText(): string;
  setEditorText(text: string): void;
}

const hosts = new WeakMap<PiExtensionGeneration, PiUiHost>();
const diagnosed = new WeakMap<PiExtensionGeneration, Set<string>>();

function diagnoseOnce(
  generation: PiExtensionGeneration,
  capability: string,
  message: string,
  severity: 'warning' | 'error' = 'warning',
): void {
  let capabilities = diagnosed.get(generation);
  if (!capabilities) {
    capabilities = new Set();
    diagnosed.set(generation, capabilities);
  }
  if (capabilities.has(capability)) return;
  capabilities.add(capability);
  generation.addDiagnostic(severity, message, capability);
}

function record(generation: PiExtensionGeneration, capability: string): PiUiHost | undefined {
  generation.assertActive();
  generation.recordCapability(capability);
  const host = hosts.get(generation);
  if (!host) {
    diagnoseOnce(
      generation,
      `${capability}:no-ui`,
      `Pi extension "${generation.extensionId}" requested ${capability} without an interactive Mastra Code UI.`,
    );
  }
  return host;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Pi UI ${field} must be a string`);
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return stringValue(value, field);
}

export function bindPiUiHost(generation: PiExtensionGeneration, host: PiUiHost): () => Promise<void> {
  generation.assertActive();
  hosts.set(generation, host);
  let active = true;
  const cleanup = async () => {
    if (!active) return;
    active = false;
    if (hosts.get(generation) === host) hosts.delete(generation);
    await host.clearGeneration(generation);
  };
  const removeGenerationCleanup = generation.addCleanup(cleanup);
  return async () => {
    removeGenerationCleanup();
    await cleanup();
  };
}

export function createPiExtensionUi(generation: PiExtensionGeneration): PiExtensionUiContext {
  return Object.freeze({
    async select(title: string, options: readonly string[]): Promise<string | undefined> {
      const host = record(generation, 'ui:select');
      const normalizedTitle = stringValue(title, 'select title');
      if (!Array.isArray(options) || options.some(option => typeof option !== 'string')) {
        throw new Error('Pi UI select options must be an array of strings');
      }
      if (!host) return undefined;
      const value = await host.select(generation, normalizedTitle, options, generation.staleSignal);
      generation.assertActive();
      return value;
    },
    async confirm(title: string, message: string): Promise<boolean> {
      const host = record(generation, 'ui:confirm');
      const normalizedTitle = stringValue(title, 'confirm title');
      const normalizedMessage = stringValue(message, 'confirm message');
      if (!host) return false;
      const value = await host.confirm(generation, normalizedTitle, normalizedMessage, generation.staleSignal);
      generation.assertActive();
      return value;
    },
    async input(title: string, placeholder?: string): Promise<string | undefined> {
      const host = record(generation, 'ui:input');
      const normalizedTitle = stringValue(title, 'input title');
      const normalizedPlaceholder = optionalString(placeholder, 'input placeholder');
      if (!host) return undefined;
      const value = await host.input(generation, normalizedTitle, normalizedPlaceholder, generation.staleSignal);
      generation.assertActive();
      return value;
    },
    async editor(title: string, initialValue?: string): Promise<string | undefined> {
      const host = record(generation, 'ui:editor');
      const normalizedTitle = stringValue(title, 'editor title');
      const normalizedInitialValue = optionalString(initialValue, 'editor initial value');
      if (!host) return undefined;
      const value = await host.editor(generation, normalizedTitle, normalizedInitialValue, generation.staleSignal);
      generation.assertActive();
      return value;
    },
    notify(message: string, level: PiUiNotificationLevel = 'info'): void {
      const host = record(generation, 'ui:notify');
      const normalizedMessage = stringValue(message, 'notification message');
      if (!['info', 'warning', 'error'].includes(level))
        throw new Error(`Unsupported Pi UI notification level: ${level}`);
      host?.notify(generation, normalizedMessage, level);
    },
    setStatus(key: string, text?: string): void {
      const host = record(generation, 'ui:setStatus');
      host?.setStatus(generation, stringValue(key, 'status key'), optionalString(text, 'status text'));
    },
    setWorkingMessage(message?: string): void {
      const host = record(generation, 'ui:setWorkingMessage');
      host?.setStatus(generation, '__working__', optionalString(message, 'working message'));
    },
    setWidget(key: string, content?: unknown, options?: unknown): void {
      const host = record(generation, 'ui:setWidget');
      if (!host) return;
      const supported = host.setWidget(generation, stringValue(key, 'widget key'), content, options);
      if (!supported) {
        diagnoseOnce(
          generation,
          'ui:setWidget:unsupported-content',
          `Pi extension "${generation.extensionId}" requested a widget that cannot be represented by Mastra Code; the widget was omitted.`,
        );
      }
    },
    getTheme(): Readonly<Record<string, string>> {
      const host = record(generation, 'ui:getTheme');
      return Object.freeze({ ...(host?.getTheme() ?? {}) });
    },
    setTheme(_theme: unknown): boolean {
      record(generation, 'ui:setTheme');
      diagnoseOnce(
        generation,
        'ui:setTheme',
        `Pi extension "${generation.extensionId}" cannot replace Mastra Code's theme. Semantic theme reads remain available.`,
      );
      return false;
    },
    getEditorText(): string {
      return record(generation, 'ui:getEditorText')?.getEditorText() ?? '';
    },
    setEditorText(text: string): void {
      record(generation, 'ui:setEditorText')?.setEditorText(stringValue(text, 'editor text'));
    },
  });
}

export function createPiExtensionContext(
  generation: PiExtensionGeneration,
  options: { cwd: string; mode?: 'tui' | 'rpc' | 'json' | 'print'; signal?: AbortSignal },
): Readonly<Record<string, unknown>> {
  const ui = createPiExtensionUi(generation);
  return Object.freeze({
    cwd: options.cwd,
    mode: options.mode ?? 'print',
    hasUI: hosts.has(generation),
    ...(options.signal ? { signal: options.signal } : {}),
    ui,
  });
}
