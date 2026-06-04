# `SignalProvider` Abstraction — Design Proposal

## Problem

Building a notification signal provider today requires awkward circular wiring:

```ts
const gh = new GithubSignals();
const agent = new Agent({ inputProcessors: [gh], outputProcessors: [gh] });
gh.addAgent(agent, { getNotificationStreamOptions: ... });
```

A signal provider plays **two roles simultaneously**:
1. **Processor** — intercepts agent input/output steps (subscribe, unsubscribe, detect PR work, etc.)
2. **External monitor** — polls/watches for events when the agent is idle and pushes notification signals back

This dual role creates a bidirectional dependency: the agent needs the provider as a processor, and the provider needs the agent to send signals back. The current manual wiring is error-prone and not something third-party integrators should deal with.

## Desired API

```ts
const agent = new Agent({
  signals: [new GithubSignals({ cwd: project.rootPath })],
});
```

That's it. No `addAgent()`, no manual processor registration.

## Design

### 1. `SignalProvider` abstract class

Lives in `packages/core/src/agent/signal-provider.ts`, exported from `@mastra/core/agent`.

```ts
import type { Agent } from './agent';
import { BaseProcessor } from '../processors';
import type { Processor } from '../processors';

export type SignalProviderTarget = {
  threadId: string;
  resourceId: string;
  agentId?: string;
};

/**
 * Abstract base for notification signal providers.
 *
 * A SignalProvider is a Processor that can also monitor external sources
 * and push signals back into agent threads when the agent is idle.
 *
 * @example
 * ```ts
 * class SlackSignals extends SignalProvider<'slack-signals'> {
 *   readonly id = 'slack-signals';
 *   // implement processor hooks + monitoring methods
 * }
 *
 * const agent = new Agent({ signals: [new SlackSignals()] });
 * ```
 */
export abstract class SignalProvider<
  TId extends string = string,
> extends BaseProcessor<TId> {
  /**
   * The agent this provider is connected to.
   * Set automatically when passed to `Agent({ signals: [...] })`.
   */
  #connectedAgent?: Agent<any, any, any, any>;

  /**
   * Called by the Agent constructor to establish the bidirectional link.
   * Override to perform additional setup (always call `super.connect(agent)`).
   */
  connect(agent: Agent<any, any, any, any>): void {
    this.#connectedAgent = agent;
  }

  /**
   * Access the connected agent for sending signals/notifications.
   */
  protected get agent(): Agent<any, any, any, any> | undefined {
    return this.#connectedAgent;
  }

  // ---- External monitoring lifecycle ----

  /**
   * Start monitoring external events for a specific thread.
   * Called by the host when a thread becomes active.
   * Returns true if monitoring was started successfully.
   */
  abstract startMonitoring(
    target: SignalProviderTarget,
    options?: { immediate?: boolean },
  ): Promise<boolean> | boolean;

  /**
   * Stop monitoring for a specific thread.
   */
  abstract stopMonitoring(target: SignalProviderTarget): void;

  /**
   * Whether this provider is currently monitoring a thread.
   */
  abstract isMonitoring(target: SignalProviderTarget): boolean;

  /**
   * Stop all monitoring. Called on shutdown/cleanup.
   */
  abstract stopAll(): void;
}
```

### 2. Agent constructor changes

Add a `signals` option to `AgentConfigBase`:

```ts
interface AgentConfigBase<...> {
  // ...existing fields...

  /**
   * Signal providers that monitor external sources and push
   * notification signals into agent threads.
   *
   * Each provider is automatically registered as both an input and
   * output processor, and connected to this agent instance.
   *
   * @experimental Agent signals are experimental and may change.
   */
  signals?: SignalProvider[];
}
```

In the Agent constructor, after creating the instance:

```ts
// Wire signal providers
if (config.signals) {
  const signalProcessors = config.signals;
  
  // Prepend to inputProcessors (signals should run before user processors)
  const existingInput = this.#inputProcessors;
  this.#inputProcessors = existingInput
    ? (ctx) => {
        const resolved = typeof existingInput === 'function'
          ? existingInput(ctx) : existingInput;
        return [...signalProcessors, ...resolved];
      }
    : signalProcessors;

  // Append to outputProcessors (signals run after user processors)
  const existingOutput = this.#outputProcessors;
  this.#outputProcessors = existingOutput
    ? (ctx) => {
        const resolved = typeof existingOutput === 'function'
          ? existingOutput(ctx) : existingOutput;
        return [...resolved, ...signalProcessors];
      }
    : signalProcessors;

  // Connect each provider to this agent
  for (const provider of signalProcessors) {
    provider.connect(this);
  }
}
```

### 3. Type guard

```ts
export function isSignalProvider(obj: unknown): obj is SignalProvider {
  return obj instanceof SignalProvider;
}
```

### 4. GithubSignals migration

`GithubSignals` changes from:
```ts
export class GithubSignals implements Processor<'github-signals'> {
```
to:
```ts
import { SignalProvider } from '@mastra/core/agent';

export class GithubSignals extends SignalProvider<'github-signals'> {
```

Key changes:
- `addAgent()` → no longer needed (wired via `connect()`)
- `#agent` → `this.agent` (from base class)
- `startPollingForThread()` → implements `startMonitoring()`
- `stopPollingForThread()` → implements `stopMonitoring()`
- `isPollingThread()` → implements `isMonitoring()`
- `stopAllPolling()` → implements `stopAll()`
- Constructor option `getNotificationStreamOptions` moves to `GithubSignalsOptions` (already there)
- `__registerMastra()` → inherited from `BaseProcessor`

The `addAgent()` method can be kept as a deprecated alias for backward compatibility.

### 5. What doesn't change

- All processor hooks (`processInputStep`, `processOutputStep`, etc.) — SignalProvider inherits them from Processor
- The signal type system (`AgentSignalInput`, `CreatedAgentSignal`, etc.)
- `sendSignal()` / `sendNotificationSignal()` on Agent
- Notification delivery policies, storage, dispatcher
- The `signals` type on the Processor interface

## Usage Example

### Before

```ts
const gh = new GithubSignals({ cwd: project.rootPath });
const agent = new Agent({
  id: 'code-agent',
  name: 'Code Agent',
  model: 'openai/gpt-4',
  instructions: '...',
  inputProcessors: [gh],
  outputProcessors: [gh],
});
gh.addAgent(agent, {
  getNotificationStreamOptions: ({ resourceId, threadId }) => ({ ... }),
});
```

### After

```ts
const agent = new Agent({
  id: 'code-agent',
  name: 'Code Agent',
  model: 'openai/gpt-4',
  instructions: '...',
  signals: [
    new GithubSignals({
      cwd: project.rootPath,
      notificationStreamOptions: ({ resourceId, threadId }) => ({ ... }),
    }),
  ],
});
```

### Building a custom provider

```ts
import { SignalProvider } from '@mastra/core/agent';
import type { SignalProviderTarget } from '@mastra/core/agent';
import type { ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';

class SlackSignals extends SignalProvider<'slack-signals'> {
  readonly id = 'slack-signals';
  readonly name = 'Slack Signals';
  
  #polling = new Map<string, ReturnType<typeof setInterval>>();

  constructor(private options: { token: string; channels: string[] }) {
    super();
  }

  // Processor hook: intercept input steps to handle slack-specific signals
  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    // ... handle subscribe/unsubscribe signals, inject tools
    return {};
  }

  // External monitoring
  async startMonitoring(target: SignalProviderTarget): Promise<boolean> {
    const key = `${target.resourceId}:${target.threadId}`;
    if (this.#polling.has(key)) return true;
    
    const timer = setInterval(() => this.#poll(target), 30_000);
    this.#polling.set(key, timer);
    return true;
  }

  stopMonitoring(target: SignalProviderTarget): void {
    const key = `${target.resourceId}:${target.threadId}`;
    const timer = this.#polling.get(key);
    if (timer) { clearInterval(timer); this.#polling.delete(key); }
  }

  isMonitoring(target: SignalProviderTarget): boolean {
    return this.#polling.has(`${target.resourceId}:${target.threadId}`);
  }

  stopAll(): void {
    for (const timer of this.#polling.values()) clearInterval(timer);
    this.#polling.clear();
  }

  async #poll(target: SignalProviderTarget) {
    // Check Slack for new messages, then push notification signals
    const agent = this.agent;
    if (!agent) return;

    await agent.sendNotificationSignal(
      { source: 'slack', kind: 'new-message', priority: 'medium', summary: '...' },
      { resourceId: target.resourceId, threadId: target.threadId },
    );
  }
}
```

## File Plan

| File | Action |
|------|--------|
| `packages/core/src/agent/signal-provider.ts` | **New** — `SignalProvider` abstract class, `SignalProviderTarget` type, `isSignalProvider` guard |
| `packages/core/src/agent/types.ts` | Add `signals?: SignalProvider[]` to `AgentConfigBase` |
| `packages/core/src/agent/agent.ts` | Wire `signals` in constructor (register as processors + call `connect`) |
| `packages/core/src/agent/index.ts` | Re-export `SignalProvider`, `SignalProviderTarget`, `isSignalProvider` |
| `mastracode/src/github-signals/index.ts` | Migrate to extend `SignalProvider`, keep `addAgent()` as deprecated compat |
