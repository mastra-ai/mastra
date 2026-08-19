import type { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '@mastra/core/processors';
import type { SignalProvider } from '@mastra/core/signals';

import type { PluginContribution } from './types.js';

type LiveProvider = {
  pluginId: string;
  provider: SignalProvider<string>;
  versionStamp: string;
  started: boolean;
};

export type PluginSignalLaneOptions = {
  /**
   * Ids of providers Mastra Code wires itself (through the Agent constructor).
   * The lane refuses to start a provider that collides with one of them:
   * two live instances of the same provider silently clobber each other's
   * polling, and the built-ins are invisible to the lane's own registry.
   */
  reservedProviderIds?: string[];
  onError?: (message: string, error: unknown) => void;
};

/**
 * Owns the lifecycle of signal providers contributed by plugins.
 *
 * Providers are long-lived; processors are per-request. The Agent constructor
 * conflates the two — it harvests a provider's processors into a closure that
 * can never be undone — so plugin providers are deliberately kept out of the
 * `signals` array and driven from here instead, through the same public methods
 * the constructor uses. That is what makes a provider removable when its plugin
 * is disabled, updated or uninstalled.
 */
export class PluginSignalLane {
  readonly #live = new Map<string, LiveProvider>();
  readonly #reservedProviderIds: Set<string>;
  readonly #onError: (message: string, error: unknown) => void;
  #agent: Agent | undefined;
  #mastra: Mastra | undefined;
  // Replaced wholesale, never mutated: a request that already resolved its
  // processors keeps the array it read, so a reload mid-request cannot change
  // the pipeline underneath it.
  #inputProcessors: InputProcessorOrWorkflow[] = [];
  #outputProcessors: OutputProcessorOrWorkflow[] = [];

  constructor(options: PluginSignalLaneOptions = {}) {
    this.#reservedProviderIds = new Set(options.reservedProviderIds ?? []);
    this.#onError =
      options.onError ??
      ((message, error) => {
        console.warn(message, error);
      });
  }

  getInputProcessors(): readonly InputProcessorOrWorkflow[] {
    return this.#inputProcessors;
  }

  getOutputProcessors(): readonly OutputProcessorOrWorkflow[] {
    return this.#outputProcessors;
  }

  /**
   * Reconciles the live providers against a freshly loaded plugin list.
   *
   * A plugin whose stamp is unchanged keeps the provider instance it already
   * has, and the freshly resolved one is dropped without ever being registered,
   * connected or polled — reload re-runs every plugin's resolver, so unchanged
   * plugins hand over new instances on every call.
   *
   * Providers of plugins that went inactive, failed to load or were uninstalled
   * are absent from the contributions and get stopped here.
   */
  async sync(contributions: PluginContribution<SignalProvider<string>>[]): Promise<void> {
    const seen = new Set<string>();

    for (const { pluginId, versionStamp, value: provider } of contributions) {
      const key = `${pluginId}::${provider.id}`;
      seen.add(key);

      const live = this.#live.get(key);
      if (live && live.versionStamp === versionStamp) continue;
      if (live) await this.#retire(key, live);

      if (this.#isProviderIdTaken(provider.id)) {
        this.#onError(
          `Plugin "${pluginId}" signal provider "${provider.id}" is already running; refusing to start a second instance.`,
          undefined,
        );
        seen.delete(key);
        continue;
      }

      this.#live.set(key, { pluginId, provider, versionStamp, started: false });
    }

    for (const [key, live] of [...this.#live]) {
      if (!seen.has(key)) await this.#retire(key, live);
    }

    this.#startPending();
    this.#rebuildProcessors();
  }

  /**
   * Called once Mastra exists. Providers resolved before then are registered and
   * started here — without a Mastra instance a provider has no storage, and
   * nothing else will ever hand it one: the Agent propagates Mastra only to the
   * providers in its own `signals` array, which these deliberately are not in.
   */
  setMastra(mastra: Mastra, agent: Agent): void {
    this.#mastra = mastra;
    this.#agent = agent;
    this.#startPending();
    this.#rebuildProcessors();
  }

  /**
   * Retires every live provider and empties both processor lanes. The inverse of
   * `sync()`, for a caller that is done with this lane — an embedder sharing one
   * `PluginManager` across controllers would otherwise leave a controller's
   * providers polling after it is gone.
   */
  async stopAll(): Promise<void> {
    await Promise.all([...this.#live].map(([key, live]) => this.#retire(key, live)));
    this.#rebuildProcessors();
  }

  #startPending(): void {
    const mastra = this.#mastra;
    const agent = this.#agent;
    if (!mastra || !agent) return;

    for (const [key, live] of this.#live) {
      if (live.started) continue;
      try {
        live.provider.__registerMastra(mastra);
        live.provider.connect(agent);
        live.provider.startPolling();
        live.started = true;
        // `start()` is the provider's own warm-up and may do network work, so it
        // is not awaited — this runs on the boot path and on every plugin
        // reload, and a slow provider must not hold either up. The Agent
        // constructor treats it the same way (agent.ts: `void provider.start?.()`).
        void this.#runStart(key, live);
      } catch (error) {
        void this.#failProvider(key, live, error);
      }
    }
  }

  async #runStart(key: string, live: LiveProvider): Promise<void> {
    try {
      await live.provider.start?.();
      // Retired or replaced while warming up: whatever `start()` just armed was
      // armed after this provider was stopped, so it is stopped again. Without
      // this a provider replaced mid-warm-up keeps working against the thread
      // its successor is now watching.
      if (this.#live.get(key) !== live) await this.#stopProvider(live);
    } catch (error) {
      if (this.#live.get(key) !== live) {
        await this.#stopProvider(live);
        return;
      }
      void this.#failProvider(key, live, error);
      this.#rebuildProcessors();
    }
  }

  /**
   * Isolated: one failing provider does not take down its plugin's tools,
   * commands, skills or sibling providers. A plugin author who wants a provider
   * treated as required throws from the `signalProviders` resolver instead,
   * which fails the whole plugin record.
   */
  async #failProvider(key: string, live: LiveProvider, error: unknown): Promise<void> {
    this.#onError(`Plugin "${live.pluginId}" signal provider "${live.provider.id}" failed to start:`, error);
    await this.#retire(key, live);
  }

  async #retire(key: string, live: LiveProvider): Promise<void> {
    if (this.#live.get(key) === live) this.#live.delete(key);
    await this.#stopProvider(live);
  }

  async #stopProvider(live: LiveProvider): Promise<void> {
    try {
      await live.provider.stop();
    } catch (error) {
      this.#onError(`Plugin "${live.pluginId}" signal provider "${live.provider.id}" failed to stop:`, error);
    }
  }

  #isProviderIdTaken(providerId: string): boolean {
    if (this.#reservedProviderIds.has(providerId)) return true;
    for (const live of this.#live.values()) {
      if (live.provider.id === providerId) return true;
    }
    return false;
  }

  #rebuildProcessors(): void {
    const input: InputProcessorOrWorkflow[] = [];
    const output: OutputProcessorOrWorkflow[] = [];
    for (const live of this.#live.values()) {
      // Only started providers contribute: one that has not been handed Mastra
      // yet has no storage, so running its processors would fail on the first
      // request rather than wait for the lifecycle to complete.
      if (!live.started) continue;
      // Guarded like every other provider call: a throwing getter drops that
      // provider's processors from this rebuild instead of unwinding the whole
      // lane mid-sync. Both getters are read before either lane is touched so a
      // provider never contributes input processors without its output ones.
      try {
        const providerInput = live.provider.getInputProcessors?.() ?? [];
        const providerOutput = live.provider.getOutputProcessors?.() ?? [];
        input.push(...providerInput);
        output.push(...providerOutput);
      } catch (error) {
        this.#onError(
          `Plugin "${live.pluginId}" signal provider "${live.provider.id}" failed to provide processors:`,
          error,
        );
      }
    }
    this.#inputProcessors = input;
    this.#outputProcessors = output;
  }
}
