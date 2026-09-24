import type { ChannelProviderLike } from './channel-provider.js';

/**
 * Structural view of the pieces of a Chat SDK `Adapter` this shim relies on.
 * Kept minimal so we don't import the `chat` types just to hold a reference.
 */
interface AdapterLike {
  readonly name: string;
}

/**
 * Structural view of the parts of `AgentChannels` this shim uses. `AgentChannels`
 * lives in `@mastra/core/channels`; declaring the shape here avoids a hard
 * dependency and keeps the shim tolerant to slightly different core minor
 * versions.
 */
interface AgentChannelsLike {
  __registerAdapter(platform: string, adapter: AdapterLike): void;
  initialize?(mastra: unknown): Promise<void>;
  __setLogger?(logger: unknown): void;
}

interface AgentLike {
  readonly id?: string;
  readonly name?: string;
  getChannels?(): AgentChannelsLike | null | undefined;
  setChannels?(channels: AgentChannelsLike): void;
}

interface MastraLike {
  listAgents?(): Record<string, AgentLike> | undefined;
  getLogger?(): unknown;
}

/**
 * Adapts a raw Chat SDK `Adapter` (like `createDiscordAdapter()`'s return
 * value) into the minimal `ChannelProvider` surface that `Mastra({ channels })`
 * consumes. When Mastra calls `initialize()` after agents are registered, the
 * shim iterates every agent and registers the adapter into that agent's
 * `AgentChannels`, constructing a fresh one when the agent has none.
 *
 * @internal Only used inside `@mastra/connect` to normalize Discord's raw
 * adapter into the uniform `ChannelProvider` shape.
 */
export class AdapterChannelProvider implements ChannelProviderLike {
  readonly id: string;
  readonly #adapter: AdapterLike;
  #mastra?: MastraLike;

  constructor(adapter: AdapterLike, id?: string) {
    this.#adapter = adapter;
    this.id = id ?? adapter.name;
  }

  /**
   * Routes for the wrapped adapter come from each agent's `AgentChannels`
   * once the adapter is registered on it in `initialize()`. The shim returns
   * no top-level routes of its own.
   */
  getRoutes(): unknown[] {
    return [];
  }

  __attach(mastra: unknown): void {
    this.#mastra = mastra as MastraLike;
  }

  async initialize(): Promise<void> {
    const mastra = this.#mastra;
    if (!mastra || typeof mastra.listAgents !== 'function') return;
    const agents = mastra.listAgents() ?? {};
    for (const agent of Object.values(agents)) {
      if (!agent || typeof agent.getChannels !== 'function') continue;
      const existing = agent.getChannels();
      if (existing) {
        existing.__registerAdapter(this.#adapter.name, this.#adapter);
        continue;
      }
      // No AgentChannels yet: build one containing just this adapter and hand
      // it to the agent. We import AgentChannels lazily so this file doesn't
      // pull `@mastra/core/channels` into the module graph on load.
      const mod = (await import('@mastra/core/channels')) as unknown as {
        AgentChannels: new (config: { adapters: Record<string, AdapterLike>; userName?: string }) => AgentChannelsLike;
      };
      const channels = new mod.AgentChannels({
        adapters: { [this.#adapter.name]: this.#adapter },
        userName: agent.name ?? agent.id ?? 'Mastra',
      });
      agent.setChannels?.(channels);
      if (mastra.getLogger) channels.__setLogger?.(mastra.getLogger());
      await channels.initialize?.(mastra);
    }
  }
}
