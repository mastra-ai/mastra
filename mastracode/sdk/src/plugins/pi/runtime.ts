import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

import {
  createPiPackageCompatibility,
  getPiCapabilitySupport,
  type PiCapabilityCompatibility,
  type PiCompatibilityDiagnostic,
  type PiPackageCompatibility,
} from './compatibility.js';
import { createPiCompatibilityDiagnostic } from './diagnostics.js';
import type {
  PiActionName,
  PiEventBusHandler,
  PiExtensionApi,
  PiExtensionGeneration,
  PiExtensionHandler,
  PiExtensionRegistrations,
  PiRegisteredFlag,
  PiRuntimeActions,
  PiRuntimeCleanup,
} from './types.js';

const NOT_INITIALIZED_ERROR =
  'Extension runtime not initialized. Action methods cannot be called during extension loading.';

function createRegistrations(): PiExtensionRegistrations {
  return {
    events: new Map(),
    tools: new Map(),
    commands: new Map(),
    shortcuts: new Map(),
    flags: new Map(),
    messageRenderers: new Map(),
    entryRenderers: new Map(),
    providers: new Map(),
    nativeProviders: [],
  };
}

export class MastraPiExtensionGeneration implements PiExtensionGeneration {
  readonly id = randomUUID();
  readonly registrations = createRegistrations();

  private readonly capabilities = new Map<string, PiCapabilityCompatibility>();
  private readonly diagnostics: PiCompatibilityDiagnostic[] = [];
  private readonly cleanups = new Set<PiRuntimeCleanup>();
  private readonly eventEmitter = new EventEmitter();
  private readonly pendingActions = new Set<Promise<unknown>>();
  private readonly staleController = new AbortController();
  private runtimeActions: PiRuntimeActions | undefined;
  private staleMessage: string | undefined;

  constructor(
    readonly pluginId: string,
    readonly extensionId: string,
    readonly entryPath: string,
  ) {}

  get staleSignal(): AbortSignal {
    return this.staleController.signal;
  }

  get active(): boolean {
    return this.staleMessage === undefined;
  }

  get bound(): boolean {
    return this.runtimeActions !== undefined;
  }

  get compatibility(): PiPackageCompatibility {
    return createPiPackageCompatibility([...this.capabilities.values()], [...this.diagnostics]);
  }

  createApi(flagValues: Readonly<Record<string, string | boolean>> = {}): PiExtensionApi {
    const callAction = (name: PiActionName, args: unknown[]): unknown => {
      this.assertActive();
      this.recordCapability(name);
      if (!this.runtimeActions) throw new Error(NOT_INITIALIZED_ERROR);
      const action = this.runtimeActions[name];
      if (!action) {
        const message = `Pi extension "${this.extensionId}" called ${name}, but the Mastra Code runtime adapter is unavailable.`;
        this.addDiagnostic('error', message, name);
        throw new Error(message);
      }
      const result = action(...args);
      if (!result || typeof (result as PromiseLike<unknown>).then !== 'function') return result;
      const pending = Promise.resolve(result);
      this.pendingActions.add(pending);
      void pending.finally(() => this.pendingActions.delete(pending)).catch(() => undefined);
      return pending;
    };

    const api: PiExtensionApi = {
      on: (event, handler) => this.registerEvent(event, handler),
      registerTool: tool => this.registerNamed('registerTool', tool.name, tool, this.registrations.tools),
      registerCommand: (name, options) =>
        this.registerNamed('registerCommand', name, options, this.registrations.commands),
      registerShortcut: (shortcut, options) =>
        this.registerNamed('registerShortcut', shortcut, options, this.registrations.shortcuts),
      registerFlag: (name, options) => this.registerFlag(name, options),
      getFlag: name => {
        this.assertActive();
        this.recordCapability('getFlag');
        const flag = this.registrations.flags.get(name);
        if (!flag) return undefined;
        const configured = flagValues[name];
        if (configured === undefined) return flag.default;
        if (typeof configured !== flag.type) {
          this.addDiagnostic(
            'warning',
            `Pi flag "${name}" has a legacy ${typeof configured} value; expected ${flag.type}. The registered default is used.`,
            'getFlag:migration',
          );
          return flag.default;
        }
        return configured;
      },
      registerMessageRenderer: (customType, renderer) =>
        this.registerNamed('registerMessageRenderer', customType, renderer, this.registrations.messageRenderers),
      registerMarkdownTransformer: transformer => {
        this.assertActive();
        this.recordCapability('registerMarkdownTransformer');
        if (this.registrations.markdownTransformer) {
          this.addDuplicateDiagnostic('registerMarkdownTransformer', 'transformer');
          return;
        }
        this.registrations.markdownTransformer = transformer;
      },
      registerEntryRenderer: (customType, renderer) =>
        this.registerNamed('registerEntryRenderer', customType, renderer, this.registrations.entryRenderers),
      sendMessage: (...args) => callAction('sendMessage', args),
      sendUserMessage: (...args) => callAction('sendUserMessage', args),
      appendEntry: (...args) => callAction('appendEntry', args),
      setSessionName: (...args) => callAction('setSessionName', args),
      getSessionName: (...args) => callAction('getSessionName', args),
      setLabel: (...args) => callAction('setLabel', args),
      exec: (...args) => callAction('exec', args),
      getActiveTools: (...args) => callAction('getActiveTools', args),
      getAllTools: (...args) => callAction('getAllTools', args),
      setActiveTools: (...args) => callAction('setActiveTools', args),
      refreshTools: (...args) => callAction('refreshTools', args),
      getCommands: (...args) => callAction('getCommands', args),
      setModel: (...args) => callAction('setModel', args),
      getModel: (...args) => callAction('getModel', args),
      getScopedModels: (...args) => callAction('getScopedModels', args),
      getThinkingLevel: (...args) => callAction('getThinkingLevel', args),
      setThinkingLevel: (...args) => callAction('setThinkingLevel', args),
      newSession: (...args) => callAction('newSession', args),
      switchSession: (...args) => callAction('switchSession', args),
      fork: (...args) => callAction('fork', args),
      navigateTree: (...args) => callAction('navigateTree', args),
      isIdle: (...args) => callAction('isIdle', args),
      waitForIdle: (...args) => callAction('waitForIdle', args),
      getPendingMessages: (...args) => callAction('getPendingMessages', args),
      abort: (...args) => callAction('abort', args),
      getContextUsage: (...args) => callAction('getContextUsage', args),
      getSystemPrompt: (...args) => callAction('getSystemPrompt', args),
      registerProvider: (providerOrName: unknown, config?: unknown) => this.registerProvider(providerOrName, config),
      unregisterProvider: name => this.unregisterProvider(name),
      events: {
        emit: (channel, data) => {
          this.assertActive();
          this.recordCapability('events');
          this.eventEmitter.emit(channel, data);
        },
        on: (channel, handler) => this.registerEventBusHandler(channel, handler),
      },
    };
    return new Proxy(api, {
      get: (target, property, receiver) => {
        if (typeof property !== 'string' || property in target) return Reflect.get(target, property, receiver);
        return (..._args: unknown[]) => {
          this.assertActive();
          const capability = `api:${property}`;
          this.recordCapability(capability);
          const message = `Pi extension "${this.extensionId}" called unknown API ${property}.`;
          this.addDiagnostic('error', message, capability);
          throw new Error(message);
        };
      },
    });
  }

  bind(actions: PiRuntimeActions = {}): Promise<void> {
    this.assertActive();
    if (this.runtimeActions) throw new Error(`Pi extension generation "${this.extensionId}" is already bound`);
    this.runtimeActions = actions;
    return (async () => {
      const registerProvider = actions.registerProvider;
      if (!registerProvider) return;
      for (const registration of this.registrations.providers.values()) {
        await registerProvider(registration.name, registration.config);
      }
    })();
  }

  addCleanup(cleanup: PiRuntimeCleanup): () => void {
    this.assertActive();
    this.cleanups.add(cleanup);
    return () => this.cleanups.delete(cleanup);
  }

  async invalidate(
    message = `Pi extension "${this.extensionId}" context is stale after reload, uninstall, or session replacement.`,
  ): Promise<void> {
    if (this.staleMessage) return;
    this.staleMessage = message;
    this.staleController.abort(new Error(message));
    this.eventEmitter.removeAllListeners();
    await Promise.allSettled([...this.pendingActions]);
    const cleanups = [...this.cleanups];
    this.cleanups.clear();
    const results = await Promise.allSettled(cleanups.map(cleanup => Promise.resolve().then(cleanup)));
    for (const result of results) {
      if (result.status === 'rejected') {
        this.addDiagnostic(
          'warning',
          `Pi extension "${this.extensionId}" cleanup failed: ${
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          }`,
          'cleanup',
        );
      }
    }
  }

  assertActive(): void {
    if (this.staleMessage) throw new Error(this.staleMessage);
  }

  hasHandlers(event: string): boolean {
    return (this.registrations.events.get(event)?.length ?? 0) > 0;
  }

  async emit(event: string, payload: unknown, context?: unknown): Promise<unknown[]> {
    this.assertActive();
    const results: unknown[] = [];
    for (const handler of this.registrations.events.get(event) ?? []) {
      try {
        results.push(await handler(payload, context));
      } catch (error) {
        this.addDiagnostic(
          'warning',
          `Pi extension "${this.extensionId}" ${event} handler failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          `event:${event}`,
        );
      }
    }
    return results;
  }

  private registerEvent(event: string, handler: PiExtensionHandler): void {
    this.assertActive();
    const capability = `event:${event}`;
    this.recordCapability(capability);
    const handlers = this.registrations.events.get(event) ?? [];
    handlers.push(handler);
    this.registrations.events.set(event, handlers);
  }

  private registerEventBusHandler(channel: string, handler: PiEventBusHandler): () => void {
    this.assertActive();
    this.recordCapability('events');
    const wrapped = (data: unknown) =>
      Promise.resolve(handler(data)).catch(error => {
        this.addDiagnostic(
          'warning',
          `Pi extension "${this.extensionId}" event-bus handler for "${channel}" failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          'events',
        );
      });
    this.eventEmitter.on(channel, wrapped);
    const unsubscribe = () => {
      this.eventEmitter.off(channel, wrapped);
    };
    this.cleanups.add(unsubscribe);
    return () => {
      this.cleanups.delete(unsubscribe);
      unsubscribe();
    };
  }

  private registerFlag(name: string, flag: PiRegisteredFlag): void {
    this.assertActive();
    this.recordCapability('registerFlag');
    if (flag.default !== undefined && typeof flag.default !== flag.type) {
      throw new Error(`Invalid default for flag "${name}": expected ${flag.type}, got ${typeof flag.default}`);
    }
    this.registerNamedValue('registerFlag', name, flag, this.registrations.flags);
  }

  private trackAction(action: Promise<unknown>, capability: string, failureMessage: string): void {
    this.pendingActions.add(action);
    void action
      .catch(error => {
        this.addDiagnostic(
          'warning',
          `${failureMessage}: ${error instanceof Error ? error.message : String(error)}`,
          capability,
        );
      })
      .finally(() => this.pendingActions.delete(action));
  }

  private registerProvider(providerOrName: unknown, config?: unknown): void {
    this.assertActive();
    if (typeof providerOrName === 'string') {
      this.recordCapability('registerProvider');
      if (config === undefined) throw new Error('Provider config is required when registering by name');
      const existed = this.registrations.providers.has(providerOrName);
      this.registerNamedValue(
        'registerProvider',
        providerOrName,
        { name: providerOrName, config },
        this.registrations.providers,
      );
      if (!existed && this.runtimeActions?.registerProvider) {
        this.trackAction(
          Promise.resolve(this.runtimeActions.registerProvider(providerOrName, config)),
          'registerProvider',
          `Pi provider "${providerOrName}" registration failed`,
        );
      }
      return;
    }
    this.recordCapability('registerNativeProvider');
  }

  private unregisterProvider(name: string): void {
    this.assertActive();
    this.recordCapability('unregisterProvider');
    if (!this.registrations.providers.delete(name)) return;
    if (this.runtimeActions?.unregisterProvider) {
      this.trackAction(
        Promise.resolve(this.runtimeActions.unregisterProvider(name)),
        'unregisterProvider',
        `Pi provider "${name}" unregister failed`,
      );
    }
  }

  private registerNamed<TValue>(
    capability: string,
    name: string,
    value: TValue,
    collection: Map<string, TValue>,
  ): void {
    this.assertActive();
    this.recordCapability(capability);
    this.registerNamedValue(capability, name, value, collection);
  }

  private registerNamedValue<TValue>(
    capability: string,
    name: string,
    value: TValue,
    collection: Map<string, TValue>,
  ): void {
    if (!name || name.trim().length === 0) throw new Error(`${capability} requires a non-empty name`);
    if (collection.has(name)) {
      this.addDuplicateDiagnostic(capability, name);
      return;
    }
    collection.set(name, value);
  }

  recordCapability(name: string): void {
    if (this.capabilities.has(name)) return;
    const support = getPiCapabilitySupport(name);
    const diagnostic =
      support === 'unsupported' || support === 'version-gated'
        ? createPiCompatibilityDiagnostic(
            this.extensionId,
            name,
            support === 'unsupported' ? 'error' : 'warning',
            `Pi extension "${this.extensionId}" uses ${name}, which is ${support} in Mastra Code.`,
          )
        : undefined;
    this.capabilities.set(name, {
      name,
      support,
      evidence: [{ source: this.entryPath }],
      diagnostics: diagnostic ? [diagnostic] : [],
    });
    if (diagnostic) this.diagnostics.push(diagnostic);
  }

  private addDuplicateDiagnostic(capability: string, name: string): void {
    this.addDiagnostic(
      'warning',
      `Pi extension "${this.extensionId}" registered duplicate ${capability} contribution "${name}"; the first registration wins.`,
      capability,
    );
  }

  addDiagnostic(severity: PiCompatibilityDiagnostic['severity'], message: string, capability: string): void {
    this.diagnostics.push(createPiCompatibilityDiagnostic(this.extensionId, capability, severity, message));
  }
}

export { NOT_INITIALIZED_ERROR as PI_EXTENSION_NOT_INITIALIZED_ERROR };
