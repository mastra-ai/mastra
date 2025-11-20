import { ConsoleLogger, LogLevel } from '@mastra/core/logger';
import { SpanType, SamplingStrategyType, TracingEventType } from '@mastra/core/observability';
import type {
  Span,
  CreateSpanOptions,
  ConfigSelector,
  ConfigSelectorOptions,
  ObservabilityInstanceConfig,
} from '@mastra/core/observability';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Observability } from './default';
import { CloudExporter, DefaultExporter } from './exporters';
import { BaseObservabilityInstance, DefaultObservabilityInstance } from './instances';
import { SensitiveDataFilter } from './span_processors';

describe('Observability Registry', () => {
  let observability = new Observability({});

  beforeEach(() => {
    vi.resetAllMocks();
    // Clear registry
    observability.clear();
  });

  afterEach(async () => {
    await observability.shutdown();
  });

  describe('Registry', () => {
    it('should register and retrieve tracing instances', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'registry-test',
        name: 'registry-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      observability.registerInstance('my-tracing', tracing);
      expect(observability.getInstance('my-tracing')).toBe(tracing);
    });

    it('should clear registry', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'registry-test',
        name: 'registry-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });
      observability.registerInstance('test', tracing);

      observability.clear();

      expect(observability.getInstance('test')).toBeUndefined();
    });

    it('should handle multiple instances', () => {
      const tracing1 = new DefaultObservabilityInstance({
        serviceName: 'test-1',
        name: 'instance-1',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });
      const tracing2 = new DefaultObservabilityInstance({
        serviceName: 'test-2',
        name: 'instance-2',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      observability.registerInstance('first', tracing1);
      observability.registerInstance('second', tracing2);

      expect(observability.getInstance('first')).toBe(tracing1);
      expect(observability.getInstance('second')).toBe(tracing2);
    });

    it('should prevent duplicate registration', () => {
      const tracing1 = new DefaultObservabilityInstance({
        serviceName: 'test-1',
        name: 'instance-1',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });
      const tracing2 = new DefaultObservabilityInstance({
        serviceName: 'test-2',
        name: 'instance-2',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      observability.registerInstance('duplicate', tracing1);

      expect(() => {
        observability.registerInstance('duplicate', tracing2);
      }).toThrow("Tracing instance 'duplicate' already registered");
    });

    it('should unregister instances correctly', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-1',
        name: 'instance-1',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      observability.registerInstance('test', tracing);
      expect(observability.getInstance('test')).toBe(tracing);

      expect(observability.unregisterInstance('test')).toBe(true);
      expect(observability.getInstance('test')).toBeUndefined();
    });

    it('should return false when unregistering non-existent instance', () => {
      expect(observability.unregisterInstance('non-existent')).toBe(false);
    });

    it('should handle observability.hasInstance checks correctly', () => {
      const enabledTracing = new DefaultObservabilityInstance({
        serviceName: 'enabled-test',
        name: 'enabled-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      observability.registerInstance('enabled', enabledTracing);

      expect(observability.hasInstance('enabled')).toBe(true);
      expect(observability.hasInstance('non-existent')).toBe(false);
    });

    it('should access tracing config through registry', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'config-test',
        name: 'config-instance',
        sampling: { type: SamplingStrategyType.RATIO, probability: 0.5 },
      });

      observability.registerInstance('config-test', tracing);
      const retrieved = observability.getInstance('config-test');

      expect(retrieved).toBeDefined();
      expect(retrieved!.getConfig().serviceName).toBe('config-test');
      expect(retrieved!.getConfig().sampling.type).toBe(SamplingStrategyType.RATIO);
    });

    it('should use selector function when provided', () => {
      const tracing1 = new DefaultObservabilityInstance({
        serviceName: 'console-tracing',
        name: 'console-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });
      const tracing2 = new DefaultObservabilityInstance({
        serviceName: 'langfuse-tracing',
        name: 'langfuse-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      observability.registerInstance('console', tracing1);
      observability.registerInstance('langfuse', tracing2);

      const selector: ConfigSelector = (context, _availableTracers) => {
        // For testing, we'll simulate routing based on request context
        if (context.requestContext?.['environment'] === 'production') return 'langfuse';
        if (context.requestContext?.['environment'] === 'development') return 'console';
        return undefined; // Fall back to default
      };

      observability.setConfigSelector(selector);

      const prodOptions: ConfigSelectorOptions = {
        requestContext: { environment: 'production' } as any,
      };

      const devOptions: ConfigSelectorOptions = {
        requestContext: { environment: 'development' } as any,
      };

      expect(observability.getSelectedInstance(prodOptions)).toBe(tracing2); // langfuse
      expect(observability.getSelectedInstance(devOptions)).toBe(tracing1); // console
    });

    it('should fall back to default when selector returns invalid name', () => {
      const tracing1 = new DefaultObservabilityInstance({
        serviceName: 'default-tracing',
        name: 'default-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      observability.registerInstance('default', tracing1, true); // Explicitly set as default

      const selector: ConfigSelector = (_context, _availableTracers) => 'non-existent';
      observability.setConfigSelector(selector);

      const options: ConfigSelectorOptions = {
        requestContext: undefined,
      };

      expect(observability.getSelectedInstance(options)).toBe(tracing1); // Falls back to default
    });

    it('should handle default tracing behavior', () => {
      const tracing1 = new DefaultObservabilityInstance({
        serviceName: 'first-tracing',
        name: 'first-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });
      const tracing2 = new DefaultObservabilityInstance({
        serviceName: 'second-tracing',
        name: 'second-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      // First registered becomes default automatically
      observability.registerInstance('first', tracing1);
      observability.registerInstance('second', tracing2);

      expect(observability.getDefaultInstance()).toBe(tracing1);

      // Explicitly set second as default
      observability.registerInstance('third', tracing2, true);
      expect(observability.getDefaultInstance()).toBe(tracing2);
    });
  });

  describe('Mastra Integration', () => {
    it('should configure tracing with simple config', async () => {
      const tracingConfig: ObservabilityInstanceConfig = {
        serviceName: 'test-service',
        name: 'test-instance',
        exporters: [],
      };

      observability = new Observability({
        configs: {
          test: tracingConfig,
        },
      });

      // Verify tracing was registered and set as default
      const tracing = observability.getInstance('test');
      expect(tracing).toBeDefined();
      expect(tracing?.getConfig().serviceName).toBe('test-service');
      expect(tracing?.getConfig().sampling?.type).toBe(SamplingStrategyType.ALWAYS); // Should default to ALWAYS
      expect(observability.getDefaultInstance()).toBe(tracing); // First one becomes default
    });

    it('should use ALWAYS sampling by default when sampling is not specified', async () => {
      const tracingConfig: ObservabilityInstanceConfig = {
        serviceName: 'default-sampling-test',
        name: 'default-sampling-instance',
      };

      observability = new Observability({
        configs: {
          test: tracingConfig,
        },
      });

      const tracing = observability.getInstance('test');
      expect(tracing?.getConfig().sampling?.type).toBe(SamplingStrategyType.ALWAYS);
    });

    it('should configure tracing with custom implementation', async () => {
      class CustomObservabilityInstance extends BaseObservabilityInstance {
        protected createSpan<TType extends SpanType>(options: CreateSpanOptions<TType>): Span<TType> {
          // Custom implementation - just return a mock span for testing
          return {
            id: 'custom-span-id',
            name: options.name,
            type: options.type,
            attributes: options.attributes,
            parent: options.parent,
            traceId: 'custom-trace-id',
            startTime: new Date(),
            observabilityInstance: this,
            isEvent: false,
            isValid: true,
            end: () => {},
            error: () => {},
            update: () => {},
            createChildSpan: () => ({}) as any,
            createEventSpan: () => ({}) as any,
            get isRootSpan() {
              return !options.parent;
            },
          } as Span<TType>;
        }
      }

      const customInstance = new CustomObservabilityInstance({
        serviceName: 'custom-service',
        name: 'custom-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      observability = new Observability({
        configs: {
          custom: customInstance,
        },
      });

      // Verify custom implementation was registered
      const tracing = observability.getInstance('custom');
      expect(tracing).toBeDefined();
      expect(tracing).toBe(customInstance);
      expect(tracing?.getConfig().serviceName).toBe('custom-service');
    });

    it('should support mixed configuration (config + instance)', async () => {
      class CustomObservabilityInstance extends BaseObservabilityInstance {
        protected createSpan<TType extends SpanType>(_options: CreateSpanOptions<TType>): Span<TType> {
          return {} as Span<TType>; // Mock implementation
        }
      }

      const customInstance = new CustomObservabilityInstance({
        serviceName: 'custom-service',
        name: 'custom-instance',
        sampling: { type: SamplingStrategyType.NEVER },
      });

      observability = new Observability({
        configs: {
          standard: {
            serviceName: 'standard-service',
            exporters: [],
          },
          custom: customInstance,
        },
        configSelector: () => 'standard', // Required when multiple configs are present
      });

      // Verify both instances were registered
      const standardTracing = observability.getInstance('standard');
      const customTracing = observability.getInstance('custom');

      expect(standardTracing).toBeDefined();
      expect(standardTracing).toBeInstanceOf(DefaultObservabilityInstance);
      expect(standardTracing?.getConfig().serviceName).toBe('standard-service');

      expect(customTracing).toBeDefined();
      expect(customTracing).toBe(customInstance);
      expect(customTracing?.getConfig().serviceName).toBe('custom-service');
    });

    it('should handle registry shutdown during Mastra shutdown', async () => {
      let shutdownCalled = false;

      class TestInstance extends BaseObservabilityInstance {
        protected createSpan<TType extends SpanType>(_options: CreateSpanOptions<TType>): Span<TType> {
          return {} as Span<TType>;
        }

        async shutdown(): Promise<void> {
          shutdownCalled = true;
          await super.shutdown();
        }
      }

      const testInstance = new TestInstance({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      observability = new Observability({
        configs: {
          test: testInstance,
        },
      });

      // Verify instance is registered
      expect(observability.getInstance('test')).toBe(testInstance);

      // Shutdown should call instance shutdown and clear registry
      await observability.shutdown();

      expect(shutdownCalled).toBe(true);
      expect(observability.getInstance('test')).toBeUndefined();
    });

    it('should support selector function configuration', async () => {
      const selector: ConfigSelector = (context, _availableTracers) => {
        if (context.requestContext?.['service'] === 'agent') return 'langfuse';
        if (context.requestContext?.['service'] === 'workflow') return 'datadog';
        return undefined; // Use default
      };

      observability = new Observability({
        configs: {
          console: {
            serviceName: 'console-service',
            exporters: [],
          },
          langfuse: {
            serviceName: 'langfuse-service',
            exporters: [],
          },
          datadog: {
            serviceName: 'datadog-service',
            exporters: [],
          },
        },
        configSelector: selector,
      });

      // Test selector functionality
      const agentOptions: ConfigSelectorOptions = {
        requestContext: { service: 'agent' } as any,
      };

      const workflowOptions: ConfigSelectorOptions = {
        requestContext: { service: 'workflow' } as any,
      };

      const genericOptions: ConfigSelectorOptions = {
        requestContext: undefined,
      };

      // Verify selector routes correctly
      expect(observability.getSelectedInstance(agentOptions)).toBe(observability.getInstance('langfuse'));
      expect(observability.getSelectedInstance(workflowOptions)).toBe(observability.getInstance('datadog'));
      expect(observability.getSelectedInstance(genericOptions)).toBe(observability.getDefaultInstance()); // Falls back to default (console)
    });
  });

  describe('observability = new Observability edge cases', () => {
    it('should handle config.configs being undefined', () => {
      expect(() => {
        observability = new Observability({
          default: { enabled: false },
          // configs is undefined
        });
      }).not.toThrow();
    });

    it('should handle config.configs being empty array', () => {
      expect(() => {
        observability = new Observability({
          default: { enabled: false },
          configs: [] as any, // Empty array instead of object
        });
      }).not.toThrow();
    });

    it('should handle config.configs being undefined with default enabled', () => {
      expect(() => {
        observability = new Observability({
          default: { enabled: true },
          // configs is undefined - should not throw "Cannot read properties of undefined"
        });
      }).not.toThrow();

      // Should still create the default instance
      const defaultInstance = observability.getInstance('default');
      expect(defaultInstance).toBeDefined();
    });

    it('should handle empty configs object', () => {
      expect(() => {
        observability = new Observability({
          default: { enabled: false },
          configs: {}, // Empty object
        });
      }).not.toThrow();
    });

    it('should handle minimal config with just selector', () => {
      const selector: ConfigSelector = () => undefined;

      expect(() => {
        observability = new Observability({
          configSelector: selector,
          // No default, no configs
        });
      }).not.toThrow();
    });

    it('should handle config with null configs property', () => {
      expect(() => {
        observability = new Observability({
          default: { enabled: true },
          configs: null as any, // null instead of undefined or object
        });
      }).not.toThrow();
    });

    it('should verify the fix for accessing undefined configs.default', () => {
      // This test specifically checks that we don't get:
      // "Cannot read properties of undefined (reading 'default')"
      // when config.configs is undefined but config.default is enabled

      expect(() => {
        observability = new Observability({
          default: { enabled: true },
          // configs intentionally undefined to test the original bug
        });
      }).not.toThrow();
    });

    it('should verify the fix for Object.entries on undefined configs', () => {
      // This test specifically checks that we don't get:
      // "Cannot convert undefined or null to object"
      // when trying to do Object.entries(config.configs)

      expect(() => {
        observability = new Observability({
          default: { enabled: false },
          // configs intentionally undefined to test the original bug
        });
      }).not.toThrow();
    });

    it('should handle when entire config is undefined', () => {
      expect(() => {
        observability = new Observability(undefined as any);
      }).not.toThrow();
    });

    it('should handle when entire config is empty object', () => {
      expect(() => {
        observability = new Observability({});
      }).not.toThrow();
    });

    it('should handle when default property is undefined', () => {
      expect(() => {
        observability = new Observability({
          default: undefined,
          configs: {
            test: {
              serviceName: 'test-service',
              exporters: [],
            },
          },
        });
      }).not.toThrow();
    });

    it('should handle when default property is empty object', () => {
      expect(() => {
        observability = new Observability({
          default: {} as any,
          configs: {
            test: {
              serviceName: 'test-service',
              exporters: [],
            },
          },
        });
      }).not.toThrow();
    });

    it('should handle when default property is null', () => {
      expect(() => {
        observability = new Observability({
          default: null as any,
          configs: {
            test: {
              serviceName: 'test-service',
              exporters: [],
            },
          },
        });
      }).not.toThrow();
    });

    it('should handle when default.enabled is undefined', () => {
      expect(() => {
        observability = new Observability({
          default: { enabled: undefined } as any,
          configs: {
            test: {
              serviceName: 'test-service',
              exporters: [],
            },
          },
        });
      }).not.toThrow();
    });

    it('should handle completely minimal config', () => {
      expect(() => {
        observability = new Observability({
          default: undefined,
          configs: undefined,
          configSelector: undefined,
        });
      }).not.toThrow();
    });
  });

  describe('Default Config', () => {
    beforeEach(() => {
      // Mock environment variable for CloudExporter
      vi.stubEnv('MASTRA_CLOUD_ACCESS_TOKEN', 'test-token-123');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should create default config when enabled', async () => {
      observability = new Observability({
        default: { enabled: true },
        configs: {},
      });

      const defaultInstance = observability.getInstance('default');
      expect(defaultInstance).toBeDefined();
      expect(defaultInstance?.getConfig().serviceName).toBe('mastra');
      expect(defaultInstance?.getConfig().sampling.type).toBe(SamplingStrategyType.ALWAYS);

      // Verify it's set as the default
      expect(observability.getDefaultInstance()).toBe(defaultInstance);

      // Verify exporters
      const exporters = defaultInstance?.getExporters();
      expect(exporters).toHaveLength(2);
      console.log(exporters);
      expect(exporters?.[0]).toBeInstanceOf(DefaultExporter);
      expect(exporters?.[1]).toBeInstanceOf(CloudExporter);

      // Verify processors
      const processors = defaultInstance?.getSpanOutputProcessors();
      expect(processors).toHaveLength(1);
      expect(processors?.[0]).toBeInstanceOf(SensitiveDataFilter);
    });

    it('should not create default config when disabled', async () => {
      observability = new Observability({
        default: { enabled: false },
        configs: {
          custom: {
            serviceName: 'custom-service',
            exporters: [],
          },
        },
      });

      const defaultInstance = observability.getInstance('default');
      expect(defaultInstance).toBeUndefined();

      // Custom config should be the default
      const customInstance = observability.getInstance('custom');
      expect(observability.getDefaultInstance()).toBe(customInstance);
    });

    it('should not create default config when default property is not provided', async () => {
      observability = new Observability({
        configs: {
          custom: {
            serviceName: 'custom-service',
            exporters: [],
          },
        },
      });

      const defaultInstance = observability.getInstance('default');
      expect(defaultInstance).toBeUndefined();
    });

    it('should throw error when default is enabled with configs', () => {
      expect(() => {
        observability = new Observability({
          default: { enabled: true },
          configs: {
            myConfig: {
              serviceName: 'my-custom-service',
              exporters: [],
            },
          },
        });
      }).toThrow(/Cannot specify both "default".*and "configs"/);
    });

    it('should allow custom config named "default" when default config is disabled', async () => {
      observability = new Observability({
        default: { enabled: false },
        configs: {
          default: {
            serviceName: 'my-custom-default',
            exporters: [],
          },
        },
      });

      const defaultInstance = observability.getInstance('default');
      expect(defaultInstance).toBeDefined();
      expect(defaultInstance?.getConfig().serviceName).toBe('my-custom-default');
    });

    it('should work with multiple custom configs', async () => {
      observability = new Observability({
        configs: {
          custom1: {
            serviceName: 'custom-service-1',
            exporters: [],
          },
          custom2: {
            serviceName: 'custom-service-2',
            exporters: [],
          },
        },
        configSelector: () => 'custom1', // Required when multiple configs are present
      });

      // First config should become the default
      const defaultInstance = observability.getDefaultInstance();
      expect(defaultInstance).toBeDefined();
      expect(defaultInstance?.getConfig().serviceName).toBe('custom-service-1');

      // Custom configs should exist
      const custom1 = observability.getInstance('custom1');
      expect(custom1).toBeDefined();
      expect(custom1?.getConfig().serviceName).toBe('custom-service-1');

      const custom2 = observability.getInstance('custom2');
      expect(custom2).toBeDefined();
      expect(custom2?.getConfig().serviceName).toBe('custom-service-2');
    });

    it('should work with selector when using custom configs', async () => {
      const selector: ConfigSelector = (context, _availableTracers) => {
        if (context.requestContext?.['useConfig1'] === true) return 'config1';
        return 'config2';
      };

      observability = new Observability({
        configs: {
          config1: {
            serviceName: 'service-1',
            exporters: [],
          },
          config2: {
            serviceName: 'service-2',
            exporters: [],
          },
        },
        configSelector: selector,
      });

      const config1Options: ConfigSelectorOptions = {
        requestContext: { useConfig1: true } as any,
      };

      const config2Options: ConfigSelectorOptions = {
        requestContext: { useConfig1: false } as any,
      };

      // Should route to config1
      expect(observability.getSelectedInstance(config1Options)).toBe(observability.getInstance('config1'));

      // Should route to config2
      expect(observability.getSelectedInstance(config2Options)).toBe(observability.getInstance('config2'));
    });

    it('should handle CloudExporter gracefully when token is missing', async () => {
      // Clear the token environment variable
      const originalToken = process.env.MASTRA_CLOUD_ACCESS_TOKEN;
      delete process.env.MASTRA_CLOUD_ACCESS_TOKEN;
      vi.unstubAllEnvs(); // Make sure mock is cleared

      const logger = new ConsoleLogger({ level: LogLevel.DEBUG });

      // Spy on console to check for warning message
      // Note: ConsoleLogger.warn() calls console.info() internally
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      // CloudExporter should not throw, but log warning instead
      const exporter = new CloudExporter({ logger });

      // Verify warning message was logged with new exporter name
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'mastra-cloud-observability-exporter disabled: MASTRA_CLOUD_ACCESS_TOKEN environment variable not set',
        ),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sign up for Mastra Cloud at https://cloud.mastra.ai'),
      );

      // Verify exporter is disabled but doesn't throw
      const event = {
        type: TracingEventType.SPAN_ENDED,
        span: {
          id: 'test-span',
          traceId: 'test-trace',
          name: 'test',
          type: SpanType.GENERIC,
          startTime: new Date(),
          endTime: new Date(),
        } as any,
        serviceName: 'test',
        instanceName: 'test',
        timestamp: new Date(),
      };

      // Should not throw when exporting
      await expect(exporter.exportTracingEvent(event)).resolves.not.toThrow();

      // Restore mocks
      infoSpy.mockRestore();
      if (originalToken) {
        process.env.MASTRA_CLOUD_ACCESS_TOKEN = originalToken;
      }
    });
  });
});
