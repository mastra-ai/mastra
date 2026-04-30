import type { Mastra } from '@mastra/core';
import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { RegisteredLogger } from '@mastra/core/logger';
import type { IMastraLogger } from '@mastra/core/logger';
import type {
  CorrelationContext,
  ConfigSelector,
  ConfigSelectorOptions,
  FeedbackInput,
  FeedbackEvent,
  ObservabilityEntrypoint,
  ObservabilityInstance,
  RecordedTrace,
  ScoreInput,
  ScoreEvent,
} from '@mastra/core/observability';
import type { ObservabilityStorage } from '@mastra/core/storage';
import { routeToHandler } from './bus/route-event';
import { SamplingStrategyType, observabilityRegistryConfigSchema, observabilityConfigValueSchema } from './config';
import type { ObservabilityInstanceConfig, ObservabilityRegistryConfig } from './config';
import { CloudExporter, DefaultExporter } from './exporters';
import { BaseObservabilityInstance, DefaultObservabilityInstance } from './instances';
import {
  buildFeedbackEvent,
  buildScoreEvent,
  buildRecordedFeedbackEventFromTrace,
  buildRecordedScoreEventFromTrace,
  hydrateRecordedTrace,
} from './recorded';
import { ObservabilityRegistry } from './registry';
import { SensitiveDataFilter } from './span_processors';

/**
 * Type guard to check if an object is a BaseObservability instance
 */
function isInstance(
  obj: Omit<ObservabilityInstanceConfig, 'name'> | ObservabilityInstance,
): obj is ObservabilityInstance {
  return obj instanceof BaseObservabilityInstance;
}

/**
 * Top-level observability entrypoint. Manages a registry of ObservabilityInstance
 * configurations and provides instance selection via config selectors.
 */
export class Observability extends MastraBase implements ObservabilityEntrypoint {
  #registry = new ObservabilityRegistry();
  #mastra?: Mastra;

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

    // Setup default config if enabled (deprecated)
    if (config.default?.enabled) {
      console.warn(
        '[Mastra Observability] The "default: { enabled: true }" configuration is deprecated and will be removed in a future version. ' +
          'Please use explicit configs with DefaultExporter, CloudExporter, and SensitiveDataFilter instead. ' +
          'See https://mastra.ai/docs/observability/tracing/overview for the recommended configuration.',
      );

      const defaultInstance = new DefaultObservabilityInstance({
        serviceName: 'mastra',
        name: 'default',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [new DefaultExporter(), new CloudExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      });

      // Register as default with high priority
      this.#registry.register('default', defaultInstance, true);
    }

    if (config.configs) {
      // Process user-provided configs
      const instances = Object.entries(config.configs);

      instances.forEach(([name, tracingDef], index) => {
        const instance = isInstance(tracingDef)
          ? tracingDef // Pre-instantiated custom implementation
          : new DefaultObservabilityInstance({ ...tracingDef, name }); // Config -> Observability with instance name

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

    const mastraEnvironment = mastra.getEnvironment?.();

    instances.forEach(instance => {
      // Propagate the Mastra-level environment so spans can fall back to it
      // when `metadata.environment` isn't set on a specific span.
      instance.__setMastraEnvironment?.(mastraEnvironment);

      const config = instance.getConfig();
      const exporters = instance.getExporters();
      exporters.forEach(exporter => {
        // Initialize exporter if it has an init method
        if ('init' in exporter && typeof exporter.init === 'function') {
          try {
            exporter.init({ mastra, config });
          } catch (error) {
            this.logger?.warn('Failed to initialize observability exporter', {
              exporterName: exporter.name,
              error: error instanceof Error ? error.message : String(error),
            });
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

    if (args.correlationContext) {
      await this.#emitRecordedEvent(
        buildScoreEvent({
          ...(targetTraceId ? { traceId: targetTraceId } : {}),
          ...(targetSpanId ? { spanId: targetSpanId } : {}),
          correlationContext: args.correlationContext,
          score: args.score,
        }),
      );
      return;
    }

    if (!args.traceId) {
      return;
    }

    const trace = await this.#getStoredTrace(args.traceId);
    if (!trace) {
      return;
    }

    const event = buildRecordedScoreEventFromTrace({
      trace,
      spanId: args.spanId,
      score: args.score,
    });

    if (!event) {
      return;
    }

    await this.#emitRecordedEvent(event);
  }

  async addFeedback(args: {
    traceId?: string;
    spanId?: string;
    correlationContext?: CorrelationContext;
    feedback: FeedbackInput;
  }): Promise<void> {
    const targetTraceId = args.traceId ?? args.correlationContext?.traceId;
    const targetSpanId = args.spanId ?? args.correlationContext?.spanId;

    if (args.correlationContext) {
      await this.#emitRecordedEvent(
        buildFeedbackEvent({
          ...(targetTraceId ? { traceId: targetTraceId } : {}),
          ...(targetSpanId ? { spanId: targetSpanId } : {}),
          correlationContext: args.correlationContext,
          feedback: args.feedback,
        }),
      );
      return;
    }

    if (!args.traceId) {
      return;
    }

    const trace = await this.#getStoredTrace(args.traceId);
    if (!trace) {
      return;
    }

    const event = buildRecordedFeedbackEventFromTrace({
      trace,
      spanId: args.spanId,
      feedback: args.feedback,
    });

    if (!event) {
      return;
    }

    await this.#emitRecordedEvent(event);
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

  /** Shut down all registered instances, flushing any pending data. */
  async shutdown(): Promise<void> {
    await this.#registry.shutdown();
  }

  async #getObservabilityStorage(): Promise<ObservabilityStorage | null> {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      return null;
    }

    return (await storage.getStore('observability')) ?? null;
  }

  async #getStoredTrace(traceId: string) {
    const observabilityStorage = await this.#getObservabilityStorage();
    if (!observabilityStorage) {
      return null;
    }

    return observabilityStorage.getTrace({ traceId });
  }

  #getRecordedTraceInstance(): ObservabilityInstance | undefined {
    return this.getDefaultInstance() ?? Array.from(this.listInstances().values())[0];
  }

  async #emitRecordedEvent(event: ScoreEvent | FeedbackEvent): Promise<void> {
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
      instance.__emitRecordedEvent(event);
      return;
    }

    const bridge = instance.getBridge();
    const handlerResults = [
      ...instance.getExporters().map(exporter => routeToHandler(exporter, event, this.logger)),
      ...(bridge ? [routeToHandler(bridge, event, this.logger)] : []),
    ].filter((result): result is Promise<void> => !!result && typeof result.then === 'function');

    if (handlerResults.length > 0) {
      await Promise.allSettled(handlerResults);
    }
  }
}
