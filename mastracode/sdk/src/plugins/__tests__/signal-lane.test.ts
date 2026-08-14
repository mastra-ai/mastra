import type { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '@mastra/core/processors';
import { SignalProvider } from '@mastra/core/signals';
import { describe, expect, it, vi } from 'vitest';

import { PluginSignalLane } from '../signal-lane.js';
import type { PluginContribution } from '../types.js';

class TestProvider extends SignalProvider<string> {
  readonly registeredMastra: Mastra[] = [];
  readonly connectedAgents: Agent[] = [];
  polling = 0;
  stopped = 0;
  startCalls = 0;
  failOnStart = false;

  constructor(
    readonly id: string,
    private readonly label = id,
  ) {
    super();
  }

  override __registerMastra(mastra: Mastra): void {
    this.registeredMastra.push(mastra);
  }

  override connect(agent: Agent): void {
    this.connectedAgents.push(agent);
  }

  override startPolling(): void {
    this.polling += 1;
  }

  override stop(): void {
    this.stopped += 1;
  }

  override start(): void {
    this.startCalls += 1;
    if (this.failOnStart) throw new Error('provider start failed');
  }

  override getInputProcessors(): InputProcessorOrWorkflow[] {
    return [{ id: `${this.label}-input`, processInputStep: ({ messages }: any) => messages }] as never;
  }

  override getOutputProcessors(): OutputProcessorOrWorkflow[] {
    return [{ id: `${this.label}-output`, processOutputStep: ({ messages }: any) => messages }] as never;
  }
}

function contributions(
  pluginId: string,
  versionStamp: string,
  providers: SignalProvider<string>[],
): PluginContribution<SignalProvider<string>>[] {
  return providers.map(value => ({ pluginId, versionStamp, value }));
}

const mastra = { id: 'mastra' } as unknown as Mastra;
const agent = { id: 'agent' } as unknown as Agent;

function laneWithMastra(options?: ConstructorParameters<typeof PluginSignalLane>[0]) {
  const lane = new PluginSignalLane(options);
  lane.setMastra(mastra, agent);
  return lane;
}

function processorIds(processors: ReadonlyArray<InputProcessorOrWorkflow | OutputProcessorOrWorkflow>): string[] {
  return processors.map(processor => processor.id);
}

describe('PluginSignalLane', () => {
  it('starts a plugin provider through the full lifecycle once Mastra exists', async () => {
    const provider = new TestProvider('demo-signals');
    const lane = new PluginSignalLane();

    lane.sync(contributions('acme.demo', 'v1', [provider]));

    // Deferred: a provider without Mastra has no storage, so nothing runs yet.
    expect(provider.registeredMastra).toHaveLength(0);
    expect(provider.connectedAgents).toHaveLength(0);
    expect(provider.polling).toBe(0);
    expect(lane.getInputProcessors()).toEqual([]);

    lane.setMastra(mastra, agent);

    expect(provider.registeredMastra).toEqual([mastra]);
    expect(provider.connectedAgents).toEqual([agent]);
    expect(provider.polling).toBe(1);
    expect(provider.startCalls).toBe(1);
    expect(processorIds(lane.getInputProcessors())).toEqual(['demo-signals-input']);
    expect(processorIds(lane.getOutputProcessors())).toEqual(['demo-signals-output']);
  });

  it('keeps the live provider instance when the plugin stamp is unchanged', async () => {
    const first = new TestProvider('demo-signals');
    const lane = laneWithMastra();
    lane.sync(contributions('acme.demo', 'v1', [first]));

    // Reload re-runs every plugin's resolver, so an unchanged plugin hands over
    // a brand new instance. It must be dropped on the floor.
    const second = new TestProvider('demo-signals');
    lane.sync(contributions('acme.demo', 'v1', [second]));

    expect(first.stopped).toBe(0);
    expect(first.polling).toBe(1);
    expect(second.registeredMastra).toHaveLength(0);
    expect(second.connectedAgents).toHaveLength(0);
    expect(second.polling).toBe(0);
  });

  it('stops and replaces the provider when the plugin stamp changes, leaving no orphan', async () => {
    const first = new TestProvider('demo-signals', 'old');
    const lane = laneWithMastra();
    lane.sync(contributions('acme.demo', 'v1', [first]));
    expect(processorIds(lane.getInputProcessors())).toEqual(['old-input']);

    const second = new TestProvider('demo-signals', 'new');
    lane.sync(contributions('acme.demo', 'v2', [second]));

    expect(first.stopped).toBe(1);
    expect(second.polling).toBe(1);
    // The replaced instance is gone from the cached processor arrays too — a
    // lingering reference would keep running it on every request.
    expect(processorIds(lane.getInputProcessors())).toEqual(['new-input']);
    expect(processorIds(lane.getOutputProcessors())).toEqual(['new-output']);
  });

  it('stops providers of plugins that disappear or go inactive', async () => {
    const provider = new TestProvider('demo-signals');
    const lane = laneWithMastra();
    lane.sync(contributions('acme.demo', 'v1', [provider]));

    // An inactive, blocked or uninstalled plugin contributes nothing.
    lane.sync([]);

    expect(provider.stopped).toBe(1);
    expect(lane.getInputProcessors()).toEqual([]);

    lane.sync([]);
    expect(provider.stopped).toBe(1);
  });

  it('refuses a provider whose id collides with a built-in Mastra Code provider', async () => {
    const onError = vi.fn();
    const provider = new TestProvider('task-signals');
    const lane = laneWithMastra({ reservedProviderIds: ['task-signals'], onError });

    lane.sync(contributions('acme.demo', 'v1', [provider]));

    expect(provider.polling).toBe(0);
    expect(provider.connectedAgents).toHaveLength(0);
    expect(lane.getInputProcessors()).toEqual([]);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('already running'), undefined);
  });

  it('refuses a second plugin contributing an already-live provider id', async () => {
    const onError = vi.fn();
    const first = new TestProvider('demo-signals', 'first');
    const second = new TestProvider('demo-signals', 'second');
    const lane = laneWithMastra({ onError });

    lane.sync([...contributions('acme.demo', 'v1', [first]), ...contributions('other.demo', 'v1', [second])]);

    expect(first.polling).toBe(1);
    expect(second.polling).toBe(0);
    expect(processorIds(lane.getInputProcessors())).toEqual(['first-input']);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('other.demo'), undefined);
  });

  it('isolates a provider that throws while starting, leaving its siblings live', async () => {
    const onError = vi.fn();
    const broken = new TestProvider('broken-signals');
    broken.failOnStart = true;
    const healthy = new TestProvider('healthy-signals');
    const lane = laneWithMastra({ onError });

    lane.sync(contributions('acme.demo', 'v1', [broken, healthy]));

    expect(processorIds(lane.getInputProcessors())).toEqual(['healthy-signals-input']);
    expect(broken.stopped).toBe(1);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('failed to start'), expect.any(Error));
  });

  it('drops the processors of a provider whose getter throws, leaving its siblings contributing', async () => {
    const onError = vi.fn();
    const broken = new TestProvider('broken-signals');
    broken.getInputProcessors = () => {
      throw new Error('getter exploded');
    };
    const healthy = new TestProvider('healthy-signals');
    const lane = laneWithMastra({ onError });

    lane.sync(contributions('acme.demo', 'v1', [broken, healthy]));

    // Neither lane carries anything from the broken provider: both getters are
    // read before either lane is touched, so a throw cannot leave it half-contributed.
    expect(processorIds(lane.getInputProcessors())).toEqual(['healthy-signals-input']);
    expect(processorIds(lane.getOutputProcessors())).toEqual(['healthy-signals-output']);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('failed to provide processors'), expect.any(Error));
  });

  it('does not hold up the caller while a provider warms up, and retires it if the warm-up rejects', async () => {
    const onError = vi.fn();
    const slow = new TestProvider('slow-signals');
    let failStart: (() => void) | undefined;
    slow.start = () =>
      new Promise<void>((_resolve, reject) => {
        failStart = () => reject(new Error('warm-up failed'));
      });
    const lane = laneWithMastra({ onError });

    // sync() returns while start() is still pending: it runs on the boot path
    // and on every plugin reload, so a slow provider must block neither.
    lane.sync(contributions('acme.demo', 'v1', [slow]));
    expect(slow.polling).toBe(1);
    expect(processorIds(lane.getInputProcessors())).toEqual(['slow-signals-input']);
    expect(onError).not.toHaveBeenCalled();

    failStart?.();
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('failed to start'), expect.any(Error)),
    );

    expect(slow.stopped).toBe(1);
    expect(lane.getInputProcessors()).toEqual([]);
  });

  it('stops a provider that finishes warming up after it was replaced', async () => {
    const slow = new TestProvider('demo-signals', 'old');
    let finishStart: (() => void) | undefined;
    slow.start = () =>
      new Promise<void>(resolve => {
        finishStart = resolve;
      });
    const lane = laneWithMastra();
    lane.sync(contributions('acme.demo', 'v1', [slow]));

    // Replaced mid-warm-up: stop() already ran, so anything start() arms after
    // that would outlive the instance and double up on its replacement.
    lane.sync(contributions('acme.demo', 'v2', [new TestProvider('demo-signals', 'new')]));
    expect(slow.stopped).toBe(1);

    finishStart?.();
    await vi.waitFor(() => expect(slow.stopped).toBe(2));
    expect(processorIds(lane.getInputProcessors())).toEqual(['new-input']);
  });

  it('stops every live provider on teardown', () => {
    const first = new TestProvider('first-signals');
    const second = new TestProvider('second-signals');
    const lane = laneWithMastra();
    lane.sync([...contributions('acme.one', 'v1', [first]), ...contributions('acme.two', 'v1', [second])]);
    expect(processorIds(lane.getInputProcessors())).toEqual(['first-signals-input', 'second-signals-input']);

    // A pluginManager can outlive the controller that used it, so a controller
    // that is done with the lane must leave nothing polling behind.
    lane.stopAll();

    expect(first.stopped).toBe(1);
    expect(second.stopped).toBe(1);
    expect(lane.getInputProcessors()).toEqual([]);
    expect(lane.getOutputProcessors()).toEqual([]);
  });

  it('does not mutate the processor array a request already resolved', () => {
    const first = new TestProvider('demo-signals', 'old');
    const lane = laneWithMastra();
    lane.sync(contributions('acme.demo', 'v1', [first]));

    // A reload can fire mid-request (plugin tool proxies reload before execute),
    // so the array a request in flight is running must not change underneath it.
    const inFlight = lane.getInputProcessors();
    lane.sync(contributions('acme.demo', 'v2', [new TestProvider('demo-signals', 'new')]));

    expect(processorIds(inFlight)).toEqual(['old-input']);
    expect(processorIds(lane.getInputProcessors())).toEqual(['new-input']);
  });
});
