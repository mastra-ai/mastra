import type { Mastra } from '@mastra/core';
import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { RegisteredLogger } from '@mastra/core/logger';
import type { IMastraLogger } from '@mastra/core/logger';
import type {
  ClientObservabilityProxy,
  CorrelationContext,
  ConfigSelector,
  ConfigSelectorOptions,
  FeedbackInput,
  FeedbackReplacementInput,
  FeedbackEvent,
  FeedbackReplacementEvent,
  ObservabilityEntrypoint,
  ObservabilityDropEvent,
  ObservabilityInstance,
  RecordedTrace,
  ScoreInput,
  ScoreEvent,
} from '@mastra/core/observability';
import type { ObservabilityStorage } from '@mastra/core/storage';
import { routeToHandler } from './bus/route-event';
import type { ObservabilityHandler } from './bus/route-event';
import { createClientObservabilityProxy } from './client';
import { SamplingStrategyType, observabilityRegistryConfigSchema, observabilityConfigValueSchema } from './config';
import type { ObservabilityInstanceConfig, ObservabilityRegistryConfig } from './config';
import { MastraPlatformExporter, MastraStorageExporter } from './exporters';
import { BaseObservabilityInstance, DefaultObservabilityInstance } from './instances';
import { isMastraBuiltInStorageExporter } from './instances/platform-policy';
import { setPricingGateways } from './metrics/pricing-registry';
import { buildFeedbackEvent, buildScoreEvent, hydrateRecordedTrace } from './recorded';
import { ObservabilityRegistry } from './registry';
import { SensitiveDataFilter } from './span_processors';
import type { SensitiveDataFilterOptions } from './span_processors';

/**
 * Type guard to check if an object is a BaseObservability instance
 */
function isInstance(
  obj: Omit<ObservabilityInstanceConfig, 'name'> | ObservabilityInstance,
): obj is ObservabilityInstance {
  return obj instanceof BaseObservabilityInstance;
}

/**
 * Manages observability instances and selects their configurations for Mastra operations.
 * Configure instances and exporters to collect and export telemetry.
 *
 * @example
 * `yourObservabilityConfig` defines your observability instances and exporters.
 * ```typescript
 * import { Mastra } from '@mastra/core/mastra';
 * import { Observability } from '@mastra/observability';
 *
 * const mastra = new Mastra({
 *   observability: new Observability(yourObservabilityConfig),
 * });
 * ```
 *
 * @see For related observability documentation bundled in `@mastra/core`, locate
 * `@mastra/core/package.json` with your project's resolver or package-manager
 * tooling, then read `dist/docs/SKILL.md` from that package root and follow its
 * observability reference links. Use package-manager tools for virtual or archived packages.
 *
 * @see [Observability documentation](https://mastra.ai/docs/observability/overview)
 * if packaged docs are unavailable.
 */
export class Observability extends MastraBase implements ObservabilityEntrypoint {
  #registry = new ObservabilityRegistry();
  #mastra?: Mastra;
  #clientObservabilityProxy?: ClientObservabilityProxy;
  #pendingPersistedEvents = new Set<Promise<void>>();

  constructor(config: ObservabilityRegistryConfig) {
    super({
      component: RegisteredLogger.OBSERVABILITY,
      name: 'Observability',
    });

    if (config === undefined) {
      config = {};
    }

    // Validate config with Zod
    const validationResult = observabilityRegistryConfigSchema.safeParse(config);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map(
          (err: { path: (string | number | symbol)[]; message: string }) =>
            `${err.path.join('.') || 'config'}: ${err.message}`,
        )
        .join('; ');
      throw new MastraError({
        id: 'OBSERVABILITY_INVALID_CONFIG',
        text: `Invalid observability configuration: ${errorMessages}`,
        domain: ErrorDomain.MASTRA_OBSERVABILITY,
        category: ErrorCategory.USER,
        details: {
          validationErrors: errorMessages,
        },
      });
    }

    // Validate individual configs if they are plain objects (not instances)
    if (config.configs) {
      for (const [name, configValue] of Object.entries(config.configs)) {
        if (!isInstance(configValue)) {
          const configValidation = observabilityConfigValueSchema.safeParse(configValue);
          if (!configValidation.success) {
            const errorMessages = configValidation.error.issues
              .map(
                (err: { path: (string | number | symbol)[]; message: string }) =>
                  `${err.path.join('.')}: ${err.message}`,
              )
              .join('; ');
            throw new MastraError({
              id: 'OBSERVABILITY_INVALID_INSTANCE_CONFIG',
              text: `Invalid configuration for observability instance '${name}': ${errorMessages}`,
              domain: ErrorDomain.MASTRA_OBSERVABILITY,
              category: ErrorCategory.USER,
              details: {
                instanceName: name,
                validationErrors: errorMessages,
              },
            });
          }
        }
      }
    }

    // Resolve sensitive data filter setting (defaults to enabled).
    const sensitiveDataFilterSetting = config.sensitiveDataFilter ?? true;
    const shouldAutoApplySensitiveFilter = sensitiveDataFilterSetting !== false;
    const sensitiveDataFilterOptions: SensitiveDataFilterOptions | undefined =
      typeof sensitiveDataFilterSetting === 'object' && sensitiveDataFilterSetting !== null
        ? sensitiveDataFilterSetting
        : undefined;

    const buildAutoSensitiveFilter = (): SensitiveDataFilter | undefined => {
      if (!shouldAutoApplySensitiveFilter) {
        return undefined;
      }
      return new SensitiveDataFilter(sensitiveDataFilterOptions);
    };

    // Setup default config if enabled (deprecated)
    if (config.default?.enabled) {
      console.warn(
        '[Mastra Observability] The "default: { enabled: true }" configuration is deprecated and will be removed in a future version. ' +
          'Please use explicit configs with MastraStorageExporter and MastraPlatformExporter instead. ' +
          'Sensitive data filtering is applied by default and can be controlled via the top-level "sensitiveDataFilter" option. ' +
          'See https://mastra.ai/docs/observability/tracing/overview for the recommended configuration.',
      );

      const autoFilter = buildAutoSensitiveFilter();
      const defaultInstance = new DefaultObservabilityInstance({
        serviceName: 'mastra',
        name: 'default',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: autoFilter ? [autoFilter] : [],
      });

      // Register as default with high priority
      this.#registry.register('default', defaultInstance, true);
    }

    if (config.configs) {
      // Process user-provided configs
      const instances = Object.entries(config.configs);

      instances.forEach(([name, tracingDef], index) => {
        let instance: ObservabilityInstance;
        if (isInstance(tracingDef)) {
          // Pre-instantiated custom implementation. We don't mutate it since
          // the caller already owns it; warn if no SensitiveDataFilter is
          // present and auto-apply is enabled.
          instance = tracingDef;
          if (shouldAutoApplySensitiveFilter) {
            const processors = instance.getSpanOutputProcessors?.() ?? [];
            const hasFilter = processors.some(p => p instanceof SensitiveDataFilter);
            if (!hasFilter) {
              this.logger?.warn(
                '[Mastra Observability] Pre-instantiated observability instance does not include a SensitiveDataFilter. ' +
                  'Auto-applied filtering is skipped for pre-instantiated instances. ' +
                  'Add a SensitiveDataFilter to spanOutputProcessors when constructing the instance to redact sensitive data.',
                { instanceName: name },
              );
            }
          }
        } else {
          const userProcessors = tracingDef.spanOutputProcessors ?? [];
          const hasFilter = userProcessors.some(p => p instanceof SensitiveDataFilter);
          const autoFilter = !hasFilter ? buildAutoSensitiveFilter() : undefined;
          // Auto-applied filter runs LAST so any sensitive data introduced by
          // user processors (e.g. enrichment that copies headers/config into
          // attributes) is still redacted before export.
          const spanOutputProcessors = autoFilter ? [...userProcessors, autoFilter] : userProcessors;
          instance = new DefaultObservabilityInstance({
            ...tracingDef,
            name,
            spanOutputProcessors,
          });
        }

        // First user-provided instance becomes default only if no default config
        const isDefault = !config.default?.enabled && index === 0;
        this.#registry.register(name, instance, isDefault);
      });
    }

    // Set selector function if provided
    if (config.configSelector) {
      this.#registry.setSelector(config.configSelector);
    }
  }

  /** Initialize all exporter instances with the Mastra context (storage, config, etc.). */
  setMastraContext(options: { mastra: Mastra }): void {
    const instances = this.listInstances();
    const { mastra } = options;
    this.#mastra = mastra;
    setPricingGateways(() => Object.values(mastra.listGateways?.() ?? {}));

    const mastraEnvironment = mastra.getEnvironment?.();

    instances.forEach(instance => {
      // Propagate the Mastra-level environment so spans can fall back to it
      // when `metadata.environment` isn't set on a specific span.
      instance.__setMastraEnvironment?.(mastraEnvironment);

      const config = instance.getConfig();
      const exporters = instance.getExporters();
      const emitDropEvent =
        instance instanceof BaseObservabilityInstance
          ? (event: ObservabilityDropEvent) => instance.getObservabilityBus().emitDropEvent(event)
          : undefined;
      exporters.forEach(exporter => {
        // Initialize exporter if it has an init method
        if ('init' in exporter && typeof exporter.init === 'function') {
          const handleInitError = (error: unknown) => {
            this.logger?.warn('Failed to initialize observability exporter', {
              exporterName: exporter.name,
              error: error instanceof Error ? error.message : String(error),
            });
          };

          try {
            void Promise.resolve(exporter.init({ mastra, config, emitDropEvent })).catch(handleInitError);
          } catch (error) {
            handleInitError(error);
          }
        }
      });
    });
  }

  /** Propagate a logger to this instance and all registered observability instances. */
  setLogger(options: { logger: IMastraLogger }): void {
    super.__setLogger(options.logger);
    this.listInstances().forEach(instance => {
      instance.__setLogger(options.logger);
    });
  }

  /** Get the observability instance chosen by the config selector for the given options. */
  getSelectedInstance(options: ConfigSelectorOptions): ObservabilityInstance | undefined {
    return this.#registry.getSelected(options);
  }

  async getRecordedTrace(args: { traceId: string }): Promise<RecordedTrace | null> {
    const observabilityStorage = await this.#getObservabilityStorage();
    if (!observabilityStorage) {
      return null;
    }

    const trace = await observabilityStorage.getTrace({ traceId: args.traceId });
    if (!trace) {
      return null;
    }

    return hydrateRecordedTrace({
      trace,
      emitRecordedEvent: event => this.#emitRecordedEvent(event),
      canEmitRecordedEvent: () => !!this.#getRecordedTraceInstance(),
      debugRecordedAnnotationUnavailable: ({ kind, traceId, spanId }) => {
        this.logger?.debug(
          kind === 'score'
            ? 'addScore() is unavailable; rehydrate the trace before calling addScore()'
            : 'addFeedback() is unavailable; rehydrate the trace before calling addFeedback()',
          {
            traceId,
            spanId,
          },
        );
      },
    });
  }

  async addScore(args: {
    traceId?: string;
    spanId?: string;
    correlationContext?: CorrelationContext;
    score: ScoreInput;
  }): Promise<void> {
    const targetTraceId = args.traceId ?? args.correlationContext?.traceId;
    const targetSpanId = args.spanId ?? args.correlationContext?.spanId;

    if (!targetTraceId && !args.correlationContext) return;
    await this.#emitRecordedEvent(buildScoreEvent({ ...args, traceId: targetTraceId, spanId: targetSpanId }));
  }

  async addFeedback(args: {
    traceId?: string;
    spanId?: string;
    correlationContext?: CorrelationContext;
    feedback: FeedbackInput;
  }): Promise<void> {
    const traceId = args.traceId ?? args.correlationContext?.traceId;
    const spanId = args.spanId ?? args.correlationContext?.spanId;
    if (!traceId && !args.correlationContext) return;
    await this.#emitRecordedEvent(buildFeedbackEvent({ ...args, traceId, spanId }));
  }

  async replaceFeedback(args: FeedbackReplacementInput): Promise<void> {
    if (
      !args.traceId?.trim() ||
      !args.feedback.feedbackId?.trim() ||
      !Number.isFinite(args.feedback.timestamp?.getTime())
    ) {
      throw new Error('Feedback replacement requires traceId, feedbackId, and the original timestamp');
    }
    await this.#emitRecordedEvent({
      type: 'feedback_replacement',
      feedback: {
        ...args.feedback,
        traceId: args.traceId,
        spanId: args.spanId,
        correlationContext: args.correlationContext,
      },
    });
  }

  /** @internal Queue an HTTP-created record; flush/shutdown await delivery without holding the HTTP response open. */
  async __exportPersistedEvent(event: ScoreEvent | FeedbackEvent | FeedbackReplacementEvent): Promise<void> {
    const storageExporters = new Set<ObservabilityHandler>(
      this.#getRecordedTraceInstance()?.getExporters().filter(isMastraBuiltInStorageExporter),
    );
    const pending = this.#emitRecordedEvent(event, handler => !storageExporters.has(handler));
    this.#pendingPersistedEvents.add(pending);
    void pending.then(
      () => this.#pendingPersistedEvents.delete(pending),
      error => {
        this.#pendingPersistedEvents.delete(pending);
        this.logger.error('Failed to notify exporters of persisted feedback/score', { error, eventType: event.type });
      },
    );
  }

  /** Register a named observability instance, optionally marking it as default. */
  registerInstance(name: string, instance: ObservabilityInstance, isDefault = false): void {
    this.#registry.register(name, instance, isDefault);

    // If Mastra context has already been set, propagate the environment to
    // this late-registered instance so it auto-tags spans like instances
    // registered before setMastraContext.
    if (this.#mastra) {
      instance.__setMastraEnvironment?.(this.#mastra.getEnvironment?.());
    }
  }

  /** Get a registered instance by name. */
  getInstance(name: string): ObservabilityInstance | undefined {
    return this.#registry.get(name);
  }

  /** Get the default observability instance. */
  getDefaultInstance(): ObservabilityInstance | undefined {
    return this.#registry.getDefault();
  }

  /** List all registered observability instances. */
  listInstances(): ReadonlyMap<string, ObservabilityInstance> {
    return this.#registry.list();
  }

  /** Unregister an instance by name. Returns true if it was found and removed. */
  unregisterInstance(name: string): boolean {
    return this.#registry.unregister(name);
  }

  /** Check whether an instance with the given name is registered. */
  hasInstance(name: string): boolean {
    return !!this.#registry.get(name);
  }

  /** Set the config selector used to choose an instance at runtime. */
  setConfigSelector(selector: ConfigSelector): void {
    this.#registry.setSelector(selector);
  }

  /** Remove all registered instances and reset the registry. */
  clear(): void {
    this.#registry.clear();
  }

  /** Flush all registered instances without shutting down. */
  async flush(): Promise<void> {
    await this.#drainPersistedEvents();
    await this.#registry.flush();
  }

  /** Shut down all registered instances, flushing any pending data. */
  async shutdown(): Promise<void> {
    await this.#drainPersistedEvents();
    await this.#registry.shutdown();
  }

  /** Let custom handlers finish filling exporter buffers before the instance lifecycle drains them. */
  async #drainPersistedEvents(): Promise<void> {
    while (this.#pendingPersistedEvents.size > 0) {
      await Promise.allSettled([...this.#pendingPersistedEvents]);
    }
  }

  /**
   * Returns the proxy responsible for client observability (W3C trace
   * context injection + OTLP/JSON payload reception for spans/logs
   * returned from client-side execution).
   *
   * Lazily constructed on first call. Resolves the target observability
   * instance per receive call so config selection works the same way
   * as for server-side spans.
   */
  getClientObservabilityProxy(): ClientObservabilityProxy | undefined {
    if (!this.#clientObservabilityProxy) {
      this.#clientObservabilityProxy = createClientObservabilityProxy({
        resolveInstance: () => this.getDefaultInstance(),
        logger: this.logger,
      });
    }
    return this.#clientObservabilityProxy;
  }

  async #getObservabilityStorage(): Promise<ObservabilityStorage | null> {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      return null;
    }

    return (await storage.getStore('observability')) ?? null;
  }

  #getRecordedTraceInstance(): ObservabilityInstance | undefined {
    return this.getDefaultInstance() ?? Array.from(this.listInstances().values())[0];
  }

  /** Dispatch independently; the standard bus tracks delivery, while custom instances return handler promises. */
  async #emitRecordedEvent(
    event: ScoreEvent | FeedbackEvent | FeedbackReplacementEvent,
    shouldHandle?: (handler: ObservabilityHandler) => boolean,
  ): Promise<void> {
    const instance = this.#getRecordedTraceInstance();
    if (!instance) {
      this.logger?.debug(
        event.type === 'score'
          ? 'Score event was dropped because no observability instance is registered'
          : 'Feedback event was dropped because no observability instance is registered',
        { eventType: event.type },
      );
      return;
    }

    if (instance instanceof BaseObservabilityInstance) {
      instance.__emitRecordedEvent(event, shouldHandle);
      return;
    }

    const bridge = instance.getBridge();
    const handlerResults = [
      ...instance
        .getExporters()
        .filter(exporter => !shouldHandle || shouldHandle(exporter))
        .map(exporter => routeToHandler(exporter, event, this.logger)),
      ...(bridge && (!shouldHandle || shouldHandle(bridge)) ? [routeToHandler(bridge, event, this.logger)] : []),
    ].filter((result): result is Promise<void> => !!result && typeof result.then === 'function');

    if (handlerResults.length > 0) {
      await Promise.allSettled(handlerResults);
    }
  }
}
