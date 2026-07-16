import type { Agent } from '@mastra/core/agent';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '@mastra/core/processors';
import { SignalProvider } from '@mastra/core/signals';

import type { MastraCodePluginSignalProvider } from '../plugin.js';

export type DisposableMastraCodePluginSignalProvider = MastraCodePluginSignalProvider;

export class PluginSignalProviderBridge extends SignalProvider<'mastracode-plugin-signals'> {
  readonly id = 'mastracode-plugin-signals' as const;
  private providers: DisposableMastraCodePluginSignalProvider[] = [];
  private connectedAgent?: Agent<any, any, any, any>;
  private readonly disposed = new WeakSet<DisposableMastraCodePluginSignalProvider>();

  get currentProviders(): readonly DisposableMastraCodePluginSignalProvider[] {
    return this.providers;
  }

  getInputProcessors(): InputProcessorOrWorkflow[] {
    return [];
  }

  getOutputProcessors(): OutputProcessorOrWorkflow[] {
    return [];
  }

  getCurrentInputProcessors(): InputProcessorOrWorkflow[] {
    return this.providers.flatMap(provider => provider.getInputProcessors?.() ?? []);
  }

  getCurrentOutputProcessors(): OutputProcessorOrWorkflow[] {
    return this.providers.flatMap(provider => provider.getOutputProcessors?.() ?? []);
  }

  connect(agent: Agent<any, any, any, any>): void {
    super.connect(agent);
    this.connectedAgent = agent;
    for (const provider of this.providers) this.connectProvider(provider);
  }

  async start(): Promise<void> {
    const providers = this.providers;
    const results = await Promise.allSettled(providers.map(provider => this.startProvider(provider)));
    const failedProviders = providers.filter((_, index) => results[index]?.status === 'rejected');
    if (failedProviders.length === 0) return;

    this.providers = providers.filter(provider => !failedProviders.includes(provider));
    await Promise.all(failedProviders.map(provider => this.dispose(provider)));
  }

  __registerMastra(...args: Parameters<SignalProvider['__registerMastra']>): void {
    super.__registerMastra(...args);
    for (const provider of this.providers) provider.__registerMastra(...args);
  }

  async replace(nextProviders: DisposableMastraCodePluginSignalProvider[]): Promise<void> {
    const previousProviders = this.providers;

    try {
      for (const provider of nextProviders) {
        if (this.mastra) provider.__registerMastra(this.mastra);
        if (this.connectedAgent && !previousProviders.includes(provider)) {
          this.connectProvider(provider);
          await this.startProvider(provider);
        }
      }
    } catch (error) {
      await Promise.all(
        nextProviders.filter(provider => !previousProviders.includes(provider)).map(provider => this.dispose(provider)),
      );
      throw error;
    }

    this.providers = nextProviders;
    await Promise.all(
      previousProviders.filter(provider => !nextProviders.includes(provider)).map(provider => this.dispose(provider)),
    );
  }

  stop(): void {
    super.stop();
    for (const provider of this.providers) void this.dispose(provider);
    this.providers = [];
  }

  private connectProvider(provider: DisposableMastraCodePluginSignalProvider): void {
    if (!this.connectedAgent || provider.isConnected) return;
    provider.connect(this.connectedAgent);
  }

  private async startProvider(provider: DisposableMastraCodePluginSignalProvider): Promise<void> {
    await provider.start?.();
    provider.startPolling();
  }

  private async dispose(provider: DisposableMastraCodePluginSignalProvider): Promise<void> {
    if (this.disposed.has(provider)) return;
    this.disposed.add(provider);
    provider.stop();
    await provider.dispose?.();
  }
}
