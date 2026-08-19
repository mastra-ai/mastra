import type { PiCompatibilityDiagnostic, PiPackageCompatibility } from './compatibility.js';

export type PiExtensionHandler = (event: unknown, context: unknown) => unknown | Promise<unknown>;
export type PiEventBusHandler = (data: unknown) => unknown | Promise<unknown>;
export type PiRuntimeCleanup = () => void | Promise<void>;
export type PiRuntimeAction = (...args: unknown[]) => unknown;
export type PiRuntimeActions = Partial<Record<PiActionName, PiRuntimeAction>>;

export type PiActionName =
  | 'sendMessage'
  | 'sendUserMessage'
  | 'appendEntry'
  | 'setSessionName'
  | 'getSessionName'
  | 'setLabel'
  | 'exec'
  | 'getActiveTools'
  | 'getAllTools'
  | 'setActiveTools'
  | 'getCommands'
  | 'setModel'
  | 'getThinkingLevel'
  | 'setThinkingLevel';

export interface PiRegisteredTool {
  name: string;
  label?: string;
  description?: string;
  parameters?: unknown;
  executionMode?: 'sequential' | 'parallel';
  constrainedSampling?: false | Record<string, unknown>;
  prepareArguments?: (args: unknown) => unknown;
  execute?: (...args: unknown[]) => unknown;
  renderCall?: (...args: unknown[]) => unknown;
  renderResult?: (...args: unknown[]) => unknown;
  [key: string]: unknown;
}

export interface PiRegisteredCommand {
  description?: string;
  handler: (...args: unknown[]) => unknown;
  [key: string]: unknown;
}

export interface PiRegisteredShortcut {
  description?: string;
  handler: (...args: unknown[]) => unknown;
  [key: string]: unknown;
}

export interface PiRegisteredFlag {
  description?: string;
  type: 'boolean' | 'string';
  default?: boolean | string;
}

export interface PiDeclarativeProviderRegistration {
  name: string;
  config: unknown;
}

export interface PiExtensionRegistrations {
  events: Map<string, PiExtensionHandler[]>;
  tools: Map<string, PiRegisteredTool>;
  commands: Map<string, PiRegisteredCommand>;
  shortcuts: Map<string, PiRegisteredShortcut>;
  flags: Map<string, PiRegisteredFlag>;
  messageRenderers: Map<string, (...args: unknown[]) => unknown>;
  markdownTransformer?: (...args: unknown[]) => unknown;
  entryRenderers: Map<string, (...args: unknown[]) => unknown>;
  providers: Map<string, PiDeclarativeProviderRegistration>;
  nativeProviders: unknown[];
}

export interface PiExtensionApi {
  on(event: string, handler: PiExtensionHandler): void;
  registerTool(tool: PiRegisteredTool): void;
  registerCommand(name: string, options: PiRegisteredCommand): void;
  registerShortcut(shortcut: string, options: PiRegisteredShortcut): void;
  registerFlag(name: string, options: PiRegisteredFlag): void;
  getFlag(name: string): boolean | string | undefined;
  registerMessageRenderer(customType: string, renderer: (...args: unknown[]) => unknown): void;
  registerMarkdownTransformer(transformer: (...args: unknown[]) => unknown): void;
  registerEntryRenderer(customType: string, renderer: (...args: unknown[]) => unknown): void;
  sendMessage(...args: unknown[]): unknown;
  sendUserMessage(...args: unknown[]): unknown;
  appendEntry(...args: unknown[]): unknown;
  setSessionName(...args: unknown[]): unknown;
  getSessionName(...args: unknown[]): unknown;
  setLabel(...args: unknown[]): unknown;
  exec(...args: unknown[]): unknown;
  getActiveTools(...args: unknown[]): unknown;
  getAllTools(...args: unknown[]): unknown;
  setActiveTools(...args: unknown[]): unknown;
  getCommands(...args: unknown[]): unknown;
  setModel(...args: unknown[]): unknown;
  getThinkingLevel(...args: unknown[]): unknown;
  setThinkingLevel(...args: unknown[]): unknown;
  registerProvider(provider: unknown): void;
  registerProvider(name: string, config: unknown): void;
  unregisterProvider(name: string): void;
  events: {
    emit(channel: string, data: unknown): void;
    on(channel: string, handler: PiEventBusHandler): () => void;
  };
}

export type PiExtensionFactory = (api: PiExtensionApi) => unknown | Promise<unknown>;

export interface PiExtensionGeneration {
  readonly id: string;
  readonly pluginId: string;
  readonly extensionId: string;
  readonly entryPath: string;
  readonly registrations: PiExtensionRegistrations;
  readonly compatibility: PiPackageCompatibility;
  readonly active: boolean;
  readonly bound: boolean;
  assertActive(): void;
  recordCapability(name: string): void;
  emit(event: string, payload: unknown, context?: unknown): Promise<unknown[]>;
  addDiagnostic(severity: PiCompatibilityDiagnostic['severity'], message: string, capability: string): void;
  createApi(flagValues?: Readonly<Record<string, string | boolean>>): PiExtensionApi;
  bind(actions?: PiRuntimeActions): void;
  addCleanup(cleanup: PiRuntimeCleanup): () => void;
  invalidate(message?: string): Promise<void>;
}
