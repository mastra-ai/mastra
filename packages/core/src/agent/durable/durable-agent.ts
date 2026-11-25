import type { MastraServerCache } from '../../cache/base';
import type { PubSub } from '../../events/pubsub';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { DeclaredAgentSchedule } from '../../schedules/define';
import type { FullOutput, MastraModelOutput } from '../../stream/base/output';
import type { ChunkType, MastraOnFinishCallback, MastraStreamTransformOptions } from '../../stream/types';
import type { ShouldPersistSnapshotFn } from '../../workflows/types';
import { Agent } from '../agent';
import type { MessageListInput } from '../message-list';
import type { AgentStreamBus } from '../streams/bus';
import type { AgentStreamsConfig } from '../streams/types';
import type { AgentDurableOption, ToolsInput } from '../types';

import type { ExtendedRunRegistry } from './run-registry';
import type {
  AgentAbortEventData,
  DurableAgentConfig,
  DurableAgentStreamOptions,
  DurableAgentStreamResult,
  AgentStreamEvent,
  DurableAgentStepFinishResult,
  AgentSuspendedEventData,
} from './types';
import type { createDurableAgenticWorkflow } from './workflows';

// @ts-expect-error - Legacy durable methods intentionally specialize the base Agent API.
export interface DurableAgent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> {
  stream(
    messages: MessageListInput,
    options?: DurableAgentStreamOptions<TOutput>,
  ): Promise<DurableAgentStreamResult<TOutput>>;

  resumeStream(resumeData: any, streamOptions?: any): Promise<MastraModelOutput<TOutput>>;

  /**
   * Generate a complete response from the agent using durable execution.
   *
   * Drains the underlying durable stream to completion and returns the same
   * {@link FullOutput} shape as non-durable `Agent.generate`. The underlying
   * workflow is identical to `stream()` — it just collects the final result
   * for callers that don't want to consume chunks themselves.
   *
   * This method intentionally re-implements the `stream()` setup rather than
   * delegating to `this.stream(...)` so that `prepareForDurableExecution` (and
   * downstream `convertTools`) receives `methodType: 'generate'`. Tool
   * factories that vary their `CoreTool` output based on the calling method
   * (e.g. `clientTools` vs server-side tools) rely on this signal — calling
   * `stream()` here would silently pass `methodType: 'stream'`.
   *
   * If the run suspends (e.g. tool approval or `suspend()` from a tool), the
   * returned output's `finishReason` will be `'suspended'` and
   * `suspendPayload` will be populated. Use {@link DurableAgent.resumeGenerate}
   * to continue.
   *
   * Note on suspend persistence: `DurableAgent` reports a suspension only
   * after the suspended snapshot is saved. `EventedAgent` can report it before
   * the snapshot is readable from another process, so a `resumeGenerate()`
   * issued elsewhere immediately afterwards may not find it yet.
   */
  generate(messages: MessageListInput, options?: DurableAgentStreamOptions<TOutput>): Promise<FullOutput<TOutput>>;

  /**
   * Resume a suspended durable run and drain it to a single
   * {@link FullOutput}. Mirrors {@link Agent.resumeGenerate} on top of
   * {@link DurableAgent.resume}.
   *
   * Unlike `generate()`, this delegates to `resume()` because resume reads
   * its tools from the existing run-registry entry rather than running
   * `prepareForDurableExecution` again — there is no `methodType` to thread
   * through. The same `EventedAgent` caveat about fire-and-forget snapshot
   * persistence noted on `generate()` applies if the resumed turn suspends.
   */
  resumeGenerate(
    resumeData: unknown,
    options: Parameters<DurableAgent<TAgentId, TTools, TOutput>['resume']>[2] & { runId: string },
  ): Promise<FullOutput<TOutput>>;
  /** @deprecated Use `resumeGenerate(resumeData, { runId, ...options })`, matching `Agent.resumeGenerate`. */
  resumeGenerate(
    runId: string,
    resumeData: unknown,
    options?: Parameters<DurableAgent<TAgentId, TTools, TOutput>['resume']>[2],
  ): Promise<FullOutput<TOutput>>;

  /**
   * Observe an existing stream.
   * Use this to reconnect to a stream after a network disconnection.
   *
   * To stop observing without affecting the run, call the returned `detach()`
   * or leave the `for await` loop over `fullStream` (break, return, or throw).
   * Both unsubscribe this observer only; the run keeps going and other
   * observers can still replay it. To stop observing when a request is
   * cancelled, wire its signal to `detach`:
   *
   * ```ts
   * const { fullStream, detach } = await agent.observe(runId, { offset });
   * req.signal.addEventListener('abort', detach, { once: true });
   * if (req.signal.aborted) detach();
   * for await (const chunk of fullStream) send(chunk);
   * ```
   *
   * **Warning:** The returned `cleanup()` function destroys the run's registry
   * entries and cached PubSub events (replay history), including for other
   * observers. Only call it when you are done with the run entirely. If the
   * workflow is suspended and you intend to resume later, do not call cleanup —
   * let the auto-cleanup timer handle it after FINISH/ERROR. Auto-cleanup does
   * not fire on SUSPENDED events.
   *
   * Pass `idleTimeoutMs` to bound how long the stream waits on a silent topic:
   * a durable run whose driving process crashed stops emitting chunks but never
   * publishes a terminal event, so without this `observe()` hangs forever on a
   * producerless topic. When the idle timeout fires, the optional `isAlive`
   * probe is consulted first — returning true (e.g. a live run-liveness
   * heartbeat, or a suspended HITL gate) re-arms the timer and keeps waiting,
   * while false/absent terminates the stream with an error chunk. Only an
   * `isAlive` that returns false schedules the run's full cleanup; a bare
   * `idleTimeoutMs` (no `isAlive`) only detaches this observer, so pass
   * `isAlive` if you rely on the timeout to reclaim a crashed run's state. Both
   * options are opt-in; omit them for the current unbounded behavior.
   *
   * By default the observed stream stays open when the run suspends (e.g. for
   * tool approval) so a later resume can continue on the same reader. Pass
   * `closeOnSuspend: true` to end the stream at the suspension boundary so
   * `fullStream`/`text`/`getFullOutput()` resolve instead of hanging; closing
   * stays observer-scoped, keeping the run's registry entry and replay history
   * so it can still be resumed with `resume()`/`resumeStream()`.
   */
  observe(
    runId: string,
    options?: {
      /**
       * Inclusive, zero-based PubSub event index. It counts all cached run-topic events, including
       * lifecycle events, not chunks. Each chunk carries its event's index as `chunk.index`: to resume
       * after a dropped connection, pass the `index + 1` of the last chunk that has an index. Omit it to replay all available cached events. Transports
       * without numeric offsets live-tail instead. Skipping earlier text deltas produces partial text
       * and may make structured output fail to parse; beyond retained history, an offset also skips
       * lower-index live events on numeric-offset transports. See
       * https://mastra.ai/reference/agents/durable-agent#observerunid-options.
       */
      offset?: number;
      idleTimeoutMs?: number;
      isAlive?: () => boolean | Promise<boolean>;
      /**
       * Whether this observer's stream closes when the observed run suspends
       * (e.g. for tool approval). Defaults to `false`: the stream stays open
       * across suspension so a later resume can continue on this same reader.
       *
       * Set to `true` so `fullStream`, `text`, and `getFullOutput()` resolve at
       * the suspension boundary instead of hanging. Closing stays
       * observer-scoped — the run's registry entry and replay history are
       * preserved. Resume the run with `resumeStream()`/`resume()`, which always
       * return a fresh stream.
       */
      closeOnSuspend?: boolean;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      experimentalTransform?: MastraStreamTransformOptions<TOutput>;
      onStepFinish?: (result: DurableAgentStepFinishResult) => void | Promise<void>;
      onFinish?: MastraOnFinishCallback<TOutput>;
      onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
      onAbort?: (data: AgentAbortEventData) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<Omit<DurableAgentStreamResult<TOutput>, 'runId'> & { runId: string; detach: () => void }>;

  /**
   * @deprecated Use `stream(messages, { untilIdle: true })` instead.
   *
   * Stream until all background tasks complete and the agent is idle.
   * Mirrors the regular Agent's streamUntilIdle but adapted for durable execution.
   */
  streamUntilIdle<OUTPUT = TOutput>(
    messages: MessageListInput,
    streamOptions?: DurableAgentStreamOptions<OUTPUT> & { maxIdleMs?: number },
  ): Promise<DurableAgentStreamResult<OUTPUT>>;
}

// @ts-expect-error - The merged interface preserves the legacy durable method signatures.
export class DurableAgent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends Agent<TAgentId, TTools, TOutput> {
  /** Engine this wrapper class runs on, selected through the Agent's `durable` policy. @internal */
  protected static readonly executionEngine: 'default' | 'evented' = 'default';

  protected override get returnsDurableStreamResult(): boolean {
    return true;
  }

  /** The wrapped agent */
  readonly #wrappedAgent: Agent<TAgentId, TTools, TOutput>;
  readonly #streamConfig: AgentStreamsConfig;
  #wrapperStreamBus?: AgentStreamBus;

  /** Maximum steps for the agentic loop */
  readonly #maxSteps?: number;

  /** Mastra instance (set via __setMastra when registered) */
  #mastra: Mastra | undefined;

  /**
   * User-supplied snapshot-persistence policy
   * (see DurableAgentConfig.shouldPersistSnapshot). Protected so subclasses
   * that pin their own policy (EventedAgent) can detect and warn when set.
   */
  protected readonly userShouldPersistSnapshot: ShouldPersistSnapshotFn | undefined;

  /** Storage version for new runs (see DurableAgentConfig.storageVersion) */
  #storageVersion: 1 | 2;

  /**
   * Create a new DurableAgent that wraps an existing Agent
   */
  constructor(config: DurableAgentConfig<TAgentId, TTools, TOutput>) {
    const {
      agent,
      id: idOverride,
      name: nameOverride,
      pubsub,
      cache,
      maxSteps,
      cleanupTimeoutMs,
      shouldCache,
      shouldPersistSnapshot,
      storageVersion,
    } = config;

    // Use provided id/name or fall back to agent.id/agent.name
    const agentId = idOverride ?? agent.id;
    const agentName = nameOverride ?? agent.name ?? agent.id;

    // Call Agent constructor with minimal config - we delegate to the wrapped agent
    super({
      id: agentId as TAgentId,
      name: agentName,
      // Delegate to wrapped agent's instructions
      instructions: ({ requestContext }) => agent.getInstructions({ requestContext }),
      // Preserve dynamic model resolution until a request context is available.
      model: ({ requestContext }) => agent.getModel({ requestContext }),
      notifications: agent.__getNotificationConfig(),
      durable: { executionEngine: (new.target as unknown as typeof DurableAgent).executionEngine },
    });

    this.#wrappedAgent = agent;
    // `maxRetries` is a public field on Agent, so read and write it through the wrapped agent.
    Object.defineProperty(this, 'maxRetries', {
      get: () => agent.maxRetries,
      set: (value: number | undefined) => {
        agent.maxRetries = value;
      },
      enumerable: true,
      configurable: true,
    });

    this.#maxSteps = maxSteps;
    this.#streamConfig = { pubsub, cache, cleanupTimeoutMs, shouldCache };
    this.userShouldPersistSnapshot = shouldPersistSnapshot;
    this.#storageVersion = storageVersion ?? 1;

    // Keep processor access on the wrapped agent, but dispatch through this wrapper.
    this.#wrappedAgent.getChannels()?.__setDispatchAgent(this);
  }

  // ===========================================================================
  // Lazy PubSub/Cache initialization (allows inheriting cache from Mastra)
  // ===========================================================================

  /**
   * Get the resolved cache instance.
   * Lazily initialized to allow inheriting from Mastra.
   */
  get cache(): MastraServerCache | null {
    return this.__getStreamBus().forRun(this.__usesSharedRunLog()).cache;
  }

  /**
   * Get the PubSub instance.
   * Returns CachingPubSub if caching is enabled, otherwise the inner pubsub.
   */
  get pubsub(): PubSub {
    return this.__getStreamBus().forRun(this.__usesSharedRunLog()).pubsub;
  }

  /** Kept `false`, the value this getter has always reported for durable agents. */
  override get durable(): AgentDurableOption | undefined {
    return false;
  }

  /** @internal */
  override __getStreamBus(): AgentStreamBus {
    const bus = this.#wrappedAgent.__getStreamBus(true)!;
    if (!Object.values(this.#streamConfig).some(value => value !== undefined)) return bus;
    return (this.#wrapperStreamBus ??= bus.withConfig(this.#streamConfig));
  }

  // ===========================================================================
  // Delegate to wrapped agent
  // ===========================================================================

  protected override get agentForExecution(): Agent<TAgentId, TTools, TOutput> {
    return this.#wrappedAgent;
  }

  /**
   * Get the wrapped agent instance.
   */
  get agent(): Agent<TAgentId, TTools, TOutput> {
    return this.#wrappedAgent;
  }

  /**
   * File-based schedules live on the wrapped agent: `assembleAgentFromFsEntry`
   * attaches them to the inner `Agent` before it is wrapped for durable
   * execution, and `#declaredSchedules` is private to each instance. Without
   * this delegate the wrapper would report none of its own and Mastra would
   * never sync a durable agent's `schedules/` directory.
   */
  public override getDeclaredSchedules(): DeclaredAgentSchedule[] {
    return this.#wrappedAgent.getDeclaredSchedules();
  }

  /**
   * Mirrors {@link getDeclaredSchedules} so attaching schedules to an
   * already-wrapped agent lands on the instance the getter reads from.
   */
  public override __setDeclaredSchedules(schedules: DeclaredAgentSchedule[]): void {
    this.#wrappedAgent.__setDeclaredSchedules(schedules);
  }

  /**
   * Get the run registry (for testing and advanced usage)
   */
  get runRegistry(): ExtendedRunRegistry {
    return this.executionRunRegistry;
  }

  /**
   * Get the max steps configured for this agent
   */
  get maxSteps(): number | undefined {
    return this.#maxSteps;
  }

  /**
   * Get the cleanup timeout in milliseconds.
   * Returns 0 if auto-cleanup is disabled.
   */
  get cleanupTimeoutMs(): number {
    return this.__getStreamBus().cleanupTimeoutMs;
  }

  // ===========================================================================
  // Delegate Agent methods to wrapped agent
  //
  // DurableAgent's super() only passes id, name, instructions, and model.
  // All other private fields (#tools, #memory, #workspace, #processors, etc.)
  // are empty on the DurableAgent instance. Every public/protected method that
  // reads those fields must be overridden to delegate to the wrapped agent.
  // ===========================================================================

  override __setLogger(logger: IMastraLogger) {
    super.__setLogger(logger);
    this.#wrappedAgent.__setLogger(logger);
  }

  // --- Model & LLM ---
  override getModel(options?: any) {
    return this.#wrappedAgent.getModel(options);
  }

  override getLLM(options?: any) {
    return this.#wrappedAgent.getLLM(options);
  }

  override async getModelList(requestContext?: any) {
    return this.#wrappedAgent.getModelList(requestContext);
  }
  override __getModelAndModelList(options?: Parameters<Agent<TAgentId, TTools, TOutput>['__getModelAndModelList']>[0]) {
    return this.#wrappedAgent.__getModelAndModelList(options);
  }

  override reorderModels(modelIds: string[]) {
    return this.#wrappedAgent.reorderModels(modelIds);
  }

  override updateModelInModelList(update: Parameters<Agent<TAgentId, TTools, TOutput>['updateModelInModelList']>[0]) {
    return this.#wrappedAgent.updateModelInModelList(update);
  }

  override __resetToOriginalModel() {
    this.#wrappedAgent.__resetToOriginalModel();
  }

  override __getMaxRetriesConfigured() {
    return this.#wrappedAgent.__getMaxRetriesConfigured();
  }

  override __getMaxProcessorRetries() {
    return this.#wrappedAgent.__getMaxProcessorRetries();
  }

  // --- Instructions, description, metadata ---
  override getInstructions(options?: any) {
    return this.#wrappedAgent.getInstructions(options);
  }

  override getDescription() {
    return this.#wrappedAgent.getDescription();
  }

  override getMetadata(options?: any) {
    return this.#wrappedAgent.getMetadata(options);
  }

  override getTracingPolicy() {
    return this.#wrappedAgent.getTracingPolicy();
  }

  // --- Tools ---
  override listTools(options?: any) {
    return this.#wrappedAgent.listTools(options);
  }

  override getConfiguredToolHooks() {
    return this.#wrappedAgent.getConfiguredToolHooks();
  }

  // --- Default options ---
  override getDefaultOptions(options?: any) {
    return this.#wrappedAgent.getDefaultOptions(options);
  }

  override getDefaultGenerateOptionsLegacy(options?: any) {
    return this.#wrappedAgent.getDefaultGenerateOptionsLegacy(options);
  }

  override getDefaultStreamOptionsLegacy(options?: any) {
    return this.#wrappedAgent.getDefaultStreamOptionsLegacy(options);
  }

  override getDefaultNetworkOptions(options?: any) {
    return this.#wrappedAgent.getDefaultNetworkOptions(options);
  }

  // --- Memory ---
  override getMemory(options?: any) {
    return this.#wrappedAgent.getMemory(options);
  }

  override getScopes(options?: any) {
    return this.#wrappedAgent.getScopes(options);
  }

  override hasOwnMemory(): boolean {
    return this.#wrappedAgent.hasOwnMemory();
  }
  override __hasFixedMemory(): boolean {
    return this.#wrappedAgent.__hasFixedMemory();
  }

  override getKnowledge() {
    return this.#wrappedAgent.getKnowledge();
  }

  // --- Workspace ---
  override getWorkspace(options?: any) {
    return this.#wrappedAgent.getWorkspace(options);
  }

  override hasOwnWorkspace(): boolean {
    return this.#wrappedAgent.hasOwnWorkspace?.() ?? false;
  }

  // --- Voice ---
  override getVoice(options?: any) {
    return this.#wrappedAgent.getVoice(options);
  }

  override get voice() {
    return this.#wrappedAgent.voice;
  }

  // --- Request context ---
  override get requestContextSchema() {
    return this.#wrappedAgent.requestContextSchema;
  }

  // --- Processors ---
  override async getConfiguredProcessorWorkflows() {
    return this.#wrappedAgent.getConfiguredProcessorWorkflows();
  }

  override async listInputProcessors(requestContext?: any) {
    return this.#wrappedAgent.listInputProcessors(requestContext);
  }

  override async listOutputProcessors(requestContext?: any) {
    return this.#wrappedAgent.listOutputProcessors(requestContext);
  }

  override async listErrorProcessors(requestContext?: any) {
    return this.#wrappedAgent.listErrorProcessors(requestContext);
  }

  override async resolveProcessorById<TId extends string = string>(processorId: TId, requestContext?: any) {
    return this.#wrappedAgent.resolveProcessorById(processorId, requestContext);
  }

  override async listConfiguredInputProcessors(requestContext?: any) {
    return this.#wrappedAgent.listConfiguredInputProcessors(requestContext);
  }

  override async listConfiguredOutputProcessors(requestContext?: any) {
    return this.#wrappedAgent.listConfiguredOutputProcessors(requestContext);
  }

  override async getConfiguredProcessorIds(requestContext?: any) {
    return this.#wrappedAgent.getConfiguredProcessorIds(requestContext);
  }

  override async getConfiguredErrorProcessorIds(requestContext?: any) {
    return this.#wrappedAgent.getConfiguredErrorProcessorIds(requestContext);
  }

  override async __resolveRunErrorProcessors(requestContext: any, overrides?: any) {
    return this.#wrappedAgent.__resolveRunErrorProcessors(requestContext, overrides);
  }

  override async __listLLMRequestProcessors(requestContext?: any, errorProcessorOverrides?: any) {
    return this.#wrappedAgent.__listLLMRequestProcessors(requestContext, errorProcessorOverrides);
  }

  // --- Sub-agents ---
  override listAgents(options?: any) {
    return this.#wrappedAgent.listAgents(options);
  }

  override __getStaticAgents() {
    return this.#wrappedAgent.__getStaticAgents();
  }

  override __hasSubAgentsConfigured() {
    return this.#wrappedAgent.__hasSubAgentsConfigured();
  }

  // --- Workflows ---
  override async listWorkflows(options?: any) {
    return this.#wrappedAgent.listWorkflows(options);
  }

  // --- Skills ---
  override async getSkill(skillName: string, options?: any) {
    return this.#wrappedAgent.getSkill(skillName, options);
  }

  override async listSkills(options?: any) {
    return this.#wrappedAgent.listSkills(options);
  }

  // --- Scorers ---
  override async listScorers(options?: any) {
    return this.#wrappedAgent.listScorers(options);
  }

  // --- Background tasks ---
  override getBackgroundTasksConfig() {
    return this.#wrappedAgent.getBackgroundTasksConfig();
  }

  override disableBackgroundTasks() {
    this.#wrappedAgent.disableBackgroundTasks();
  }

  override enableBackgroundTasks() {
    this.#wrappedAgent.enableBackgroundTasks();
  }

  // --- Tool payload transform & goal ---
  override getToolPayloadTransform() {
    return this.#wrappedAgent.getToolPayloadTransform();
  }

  override __getGoalConfig() {
    return this.#wrappedAgent.__getGoalConfig();
  }

  // --- Browser ---
  override get browser() {
    return this.#wrappedAgent.browser;
  }

  override setBrowser(browser: any) {
    this.#wrappedAgent.setBrowser(browser);
  }

  override hasOwnBrowser() {
    return this.#wrappedAgent.hasOwnBrowser();
  }

  // --- Channels ---
  override getChannels() {
    return this.#wrappedAgent.getChannels();
  }

  override setChannels(agentChannels: any) {
    this.#wrappedAgent.setChannels(agentChannels);
    agentChannels.__setDispatchAgent(this);
  }

  // --- PubSub (base Agent fields — DurableAgent has its own pubsub) ---
  override hasOwnPubSub() {
    return this.#wrappedAgent.hasOwnPubSub();
  }

  override getPubSub() {
    return this.#wrappedAgent.getPubSub();
  }

  // --- Setters called by AgentController — forward to BOTH wrapper and wrapped ---
  // We propagate to both so that:
  //  - The wrapped agent sees the value for its own internal use.
  //  - The DurableAgent's inherited getMemory()/getWorkspace() also work.
  override __setMemory(memory: any) {
    super.__setMemory(memory);
    this.#wrappedAgent.__setMemory(memory);
  }

  override __setPubSub(pubsub: any) {
    super.__setPubSub(pubsub);
    this.#wrappedAgent.__setPubSub(pubsub);
  }

  override __setWorkspace(workspace: any) {
    super.__setWorkspace(workspace);
    this.#wrappedAgent.__setWorkspace(workspace);
  }

  override __setKnowledge(knowledge: Parameters<Agent<TAgentId, TTools, TOutput>['__setKnowledge']>[0]) {
    this.#wrappedAgent.__setKnowledge(knowledge);
  }

  // ===========================================================================
  // Editor / fork delegation
  //
  // The base Agent serves tools/instructions/model from its own private fields,
  // but a DurableAgent serves all of them from the wrapped agent (see the
  // delegating getters above). The editor applies stored overrides per request
  // by calling `__fork()` and then mutating the fork via `__updateInstructions`
  // / `__updateModel` / `__setTools`, and inspecting it via `__getEditorConfig`
  // / `__getOverridableFields`. If those operated on the DurableAgent's own
  // (unused) base fields the served agent would silently lose its tools and
  // ignore overrides, so forward them to the wrapped agent — it stays the single
  // source of truth.
  // ===========================================================================

  override __getEditorConfig() {
    return this.#wrappedAgent.__getEditorConfig();
  }

  override __getOverridableFields() {
    return this.#wrappedAgent.__getOverridableFields();
  }

  override __updateInstructions(instructions: Parameters<Agent<TAgentId, TTools, TOutput>['__updateInstructions']>[0]) {
    this.#wrappedAgent.__updateInstructions(instructions);
  }

  override __updateModel(config: Parameters<Agent<TAgentId, TTools, TOutput>['__updateModel']>[0]) {
    this.#wrappedAgent.__updateModel(config);
  }

  override __setTools(tools: Parameters<Agent<TAgentId, TTools, TOutput>['__setTools']>[0]) {
    this.#wrappedAgent.__setTools(tools);
  }

  /**
   * Raw stored config lives on the wrapped agent for the same reason as the
   * mutators above: durable preparation and tracing read
   * `resolvedVersionId` from the wrapped agent's rawConfig, and the editor
   * stamps it on the outer fork via `__setRawConfig` after
   * `applyStoredOverrides`. Without this delegation the stamp lands on the
   * (unread) DurableAgent-level field and version metadata silently
   * disappears from spans and suspend snapshots.
   */
  override toRawConfig(): Record<string, unknown> | undefined {
    return this.#wrappedAgent.toRawConfig();
  }

  override __setRawConfig(rawConfig: Record<string, unknown>): void {
    this.#wrappedAgent.__setRawConfig(rawConfig);
  }

  /**
   * Create a per-request clone for applying stored editor overrides.
   *
   * The base `Agent.__fork()` builds a bare `new Agent(...)`, which for a
   * DurableAgent would drop the wrapped agent and every delegating override
   * (tools, model, memory, voice, durable streaming) — the served fork ends up a
   * plain `Agent` with no tools. Instead, fork the wrapped agent (so overrides
   * applied to this fork don't mutate the singleton) and re-wrap it in the same
   * durable subclass, preserving pubsub/cache/run configuration.
   *
   * @internal
   */
  override __fork(): Agent<TAgentId, TTools, TOutput> {
    const sharedChannels = this.#wrappedAgent.getChannels();
    const innerFork = this.#wrappedAgent.__fork();

    const Ctor = this.constructor as new (
      config: DurableAgentConfig<TAgentId, TTools, TOutput>,
    ) => DurableAgent<TAgentId, TTools, TOutput>;

    const fork = new Ctor({
      agent: innerFork,
      ...this.#streamConfig,
      id: this.id,
      name: this.name,
      maxSteps: this.#maxSteps,
      shouldPersistSnapshot: this.userShouldPersistSnapshot,
      storageVersion: this.#storageVersion,
    });

    // A transient version fork must not take over the singleton's channel ingress.
    if (sharedChannels && sharedChannels === innerFork.getChannels()) {
      sharedChannels.__setAgent(this.#wrappedAgent);
      sharedChannels.__setDispatchAgent(this);
    }

    // Preserve Mastra registration without re-triggering its side effects.
    // The inner fork inherits registration and resolves its shared bus lazily.
    if (this.#mastra) {
      fork.__inheritMastraForFork(this.#mastra);
      fork.#mastra = this.#mastra;
    }
    fork.source = this.source;
    // Share the untilIdle wrappers, so a task finishing under the fork's stream isn't
    // also reported by the registered agent (mirrors `Agent.__fork()`).
    fork.activeStreamUntilIdle = this.activeStreamUntilIdle;
    // `_agentNetworkAppend` is a private base-class flag; copy it via an indexed
    // cast (the same idiom the base uses in `toRawConfig()`) so the fork mirrors
    // `Agent.__fork()` without widening the field's visibility.
    (fork as unknown as { _agentNetworkAppend: unknown })._agentNetworkAppend = (
      this as unknown as { _agentNetworkAppend: unknown }
    )._agentNetworkAppend;

    // DurableAgent intentionally diverges from Agent's `stream` signature, so the
    // re-wrapped fork is bridged to the base `Agent` return type here. The editor's
    // fork-then-mutate contract only relies on the base Agent surface.
    return fork as unknown as Agent<TAgentId, TTools, TOutput>;
  }

  // ===========================================================================
  // Protected methods for subclass overrides
  // ===========================================================================

  /** Whether new runs opt into journal storage. @internal */
  protected get storesRunsInJournal(): boolean {
    return this.#storageVersion === 2;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Get the workflow instance for direct execution.
   * Lazily creates the workflow and registers Mastra on it (needed for
   * getAgentById in execution steps).
   */
  getWorkflow(): ReturnType<typeof createDurableAgenticWorkflow> {
    return (
      this.executionEngine.workflow ??
      this.executionEngine.getWorkflow({
        maxSteps: this.#maxSteps,
        workflowEngine: this.workflowEngine,
        storesRunsInJournal: this.storesRunsInJournal,
        shouldPersistSnapshot: this.userShouldPersistSnapshot,
        logger: this.logger,
        guardrailLogger: this.guardrailLogger,
      })
    );
  }

  /**
   * Get the durable workflows required by this agent.
   * Called by Mastra during agent registration.
   * @internal
   */
  getDurableWorkflows() {
    return [this.getWorkflow()];
  }

  /**
   * Set the Mastra instance.
   * Called by the durable agent registration path in addAgent().
   * Delegates to __registerMastra so the pubsub wiring and agent
   * registration happen regardless of which entry point is called first.
   * @internal
   */
  __setMastra(mastra: Mastra): void {
    this.__registerMastra(mastra);
  }

  /**
   * Register the Mastra instance.
   * Called by Mastra during agent registration (normal Agent path).
   *
   * Also wires mastra.pubsub as the inner pubsub (if the user didn't provide
   * a custom one), so that the OBSERVE_AGENT_STREAM_ROUTE handler can subscribe
   * to the same PubSub instance that this agent publishes to.
   * @internal
   */
  __registerMastra(mastra: Mastra): void {
    super.__registerMastra(mastra);
    this.#mastra = mastra;
    // Also set on wrapped agent
    this.#wrappedAgent.__registerMastra(mastra);
    this.#wrapperStreamBus?.registerMastra(mastra.pubsub);
  }
}
