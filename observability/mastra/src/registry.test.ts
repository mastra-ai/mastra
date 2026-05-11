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
import { MastraPlatformExporter, MastraStorageExporter, TestExporter } from './exporters';
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
        exporters: [new TestExporter()],
      });

      observability.registerInstance('my-tracing', tracing);
      expect(observability.getInstance('my-tracing')).toBe(tracing);
    });

    it('should clear registry', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'registry-test',
        name: 'registry-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
      });
      const tracing2 = new DefaultObservabilityInstance({
        serviceName: 'test-2',
        name: 'instance-2',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
      });
      const tracing2 = new DefaultObservabilityInstance({
        serviceName: 'test-2',
        name: 'instance-2',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
      });
      const tracing2 = new DefaultObservabilityInstance({
        serviceName: 'langfuse-tracing',
        name: 'langfuse-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
      });
      const tracing2 = new DefaultObservabilityInstance({
        serviceName: 'second-tracing',
        name: 'second-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
      });

      observability = new Observability({
        configs: {
          standard: {
            serviceName: 'standard-service',
            exporters: [new TestExporter()],
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
        exporters: [new TestExporter()],
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
            exporters: [new TestExporter()],
          },
          langfuse: {
            serviceName: 'langfuse-service',
            exporters: [new TestExporter()],
          },
          datadog: {
            serviceName: 'datadog-service',
            exporters: [new TestExporter()],
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

    it('propagates the Mastra environment to instances registered after setMastraContext', () => {
      observability = new Observability({});

      // Simulate Mastra construction: setMastraContext fires before any instance
      // is in the registry (this is the path Mastra.registerExporter takes when
      // bootstrapping observability from a NoOp).
      const fakeMastra = { getEnvironment: () => 'production' } as any;
      observability.setMastraContext({ mastra: fakeMastra });

      // Late registration — must still pick up the environment.
      const instance = new DefaultObservabilityInstance({
        serviceName: 'late-registered',
        name: 'late',
        exporters: [new TestExporter()],
      });
      observability.registerInstance('late', instance, true);

      expect(instance.getMastraEnvironment()).toBe('production');
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

    it('should reject config with just selector (no configs or default)', () => {
      const selector: ConfigSelector = () => undefined;

      expect(() => {
        observability = new Observability({
          configSelector: selector,
          // No default, no configs - this should throw
        });
      }).toThrow('A "configSelector" requires at least one config or default observability to be configured');
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
              exporters: [new TestExporter()],
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
              exporters: [new TestExporter()],
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
              exporters: [new TestExporter()],
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
              exporters: [new TestExporter()],
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
      // Mock environment variable for MastraPlatformExporter
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
      expect(exporters?.[0]).toBeInstanceOf(MastraStorageExporter);
      expect(exporters?.[1]).toBeInstanceOf(MastraPlatformExporter);

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
            exporters: [new TestExporter()],
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
            exporters: [new TestExporter()],
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
              exporters: [new TestExporter()],
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
            exporters: [new TestExporter()],
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
            exporters: [new TestExporter()],
          },
          custom2: {
            serviceName: 'custom-service-2',
            exporters: [new TestExporter()],
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
            exporters: [new TestExporter()],
          },
          config2: {
            serviceName: 'service-2',
            exporters: [new TestExporter()],
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

    describe('Sensitive Data Filter Default', () => {
      it('should auto-append SensitiveDataFilter to user configs by default', () => {
        observability = new Observability({
          configs: {
            custom: {
              serviceName: 'custom-service',
              exporters: [new TestExporter()],
            },
          },
        });

        const instance = observability.getInstance('custom');
        const processors = instance?.getSpanOutputProcessors() ?? [];
        expect(processors).toHaveLength(1);
        expect(processors[processors.length - 1]).toBeInstanceOf(SensitiveDataFilter);
      });

      it('should auto-append SensitiveDataFilter to every user config', () => {
        observability = new Observability({
          configs: {
            first: {
              serviceName: 'service-first',
              exporters: [new TestExporter()],
            },
            second: {
              serviceName: 'service-second',
              exporters: [new TestExporter()],
              spanOutputProcessors: [],
            },
          },
          configSelector: () => 'first',
        });

        const firstProcessors = observability.getInstance('first')?.getSpanOutputProcessors() ?? [];
        const secondProcessors = observability.getInstance('second')?.getSpanOutputProcessors() ?? [];

        expect(firstProcessors).toHaveLength(1);
        expect(secondProcessors).toHaveLength(1);
        expect(firstProcessors[firstProcessors.length - 1]).toBeInstanceOf(SensitiveDataFilter);
        expect(secondProcessors[secondProcessors.length - 1]).toBeInstanceOf(SensitiveDataFilter);
      });

      it('should append SensitiveDataFilter after user spanOutputProcessors so it always runs last', () => {
        // Running last guarantees that any sensitive data introduced or surfaced
        // by upstream user processors is still redacted before export.
        const userProcessor = {
          name: 'user-processor',
          process: (span: any) => span,
          shutdown: async () => {},
        };

        observability = new Observability({
          configs: {
            custom: {
              serviceName: 'custom-service',
              exporters: [new TestExporter()],
              spanOutputProcessors: [userProcessor],
            },
          },
        });

        const processors = observability.getInstance('custom')?.getSpanOutputProcessors();
        expect(processors).toHaveLength(2);
        expect(processors?.[0]).toBe(userProcessor);
        expect(processors?.[1]).toBeInstanceOf(SensitiveDataFilter);
      });

      it('should use the user-supplied SensitiveDataFilter (and its options) when one is provided', () => {
        // User supplies their own filter with custom options. We must register
        // their instance unchanged and not auto-add a second filter that would
        // override their configuration.
        const userFilter = new SensitiveDataFilter({
          redactionToken: '[USER]',
          sensitiveFields: ['mySecret'],
        });

        observability = new Observability({
          configs: {
            custom: {
              serviceName: 'custom-service',
              exporters: [new TestExporter()],
              spanOutputProcessors: [userFilter],
            },
          },
          // Even when a top-level option is set, the user-supplied filter wins.
          sensitiveDataFilter: { redactionToken: '[REGISTRY]' },
        });

        const processors = observability.getInstance('custom')?.getSpanOutputProcessors();
        expect(processors).toHaveLength(1);
        expect(processors?.[0]).toBe(userFilter);

        // Verify the user's options actually drive redaction end-to-end
        // (no double-wrapping with the registry-level config).
        const filtered = (processors?.[0] as SensitiveDataFilter).process({
          attributes: { mySecret: 'value', password: 'not-in-user-list' },
          metadata: undefined,
          input: undefined,
          output: undefined,
          errorInfo: undefined,
        } as any);

        expect((filtered as any).attributes.mySecret).toBe('[USER]');
        // password is not in the user's sensitiveFields list so it is not redacted
        expect((filtered as any).attributes.password).toBe('not-in-user-list');
      });

      it('should not auto-apply SensitiveDataFilter when set to false', () => {
        observability = new Observability({
          configs: {
            custom: {
              serviceName: 'custom-service',
              exporters: [new TestExporter()],
            },
          },
          sensitiveDataFilter: false,
        });

        const processors = observability.getInstance('custom')?.getSpanOutputProcessors();
        expect(processors).toHaveLength(0);
      });

      it('should pass options to auto-applied SensitiveDataFilter when given an object', () => {
        observability = new Observability({
          configs: {
            custom: {
              serviceName: 'custom-service',
              exporters: [new TestExporter()],
            },
          },
          sensitiveDataFilter: {
            sensitiveFields: ['customSecret'],
            redactionToken: '[CUSTOM]',
          },
        });

        const processors = observability.getInstance('custom')?.getSpanOutputProcessors();
        expect(processors).toHaveLength(1);
        const filter = processors?.[0] as SensitiveDataFilter;
        expect(filter).toBeInstanceOf(SensitiveDataFilter);

        const filtered = filter.process({
          attributes: { customSecret: 'my-value', password: 'still-redacted' },
          metadata: undefined,
          input: undefined,
          output: undefined,
          errorInfo: undefined,
        } as any);
        expect((filtered as any).attributes.customSecret).toBe('[CUSTOM]');
        // password is no longer in the override list, so it should pass through
        expect((filtered as any).attributes.password).toBe('still-redacted');
      });

      it('should still auto-apply SensitiveDataFilter under the deprecated default config', async () => {
        observability = new Observability({
          default: { enabled: true },
        });

        const defaultInstance = observability.getInstance('default');
        const processors = defaultInstance?.getSpanOutputProcessors();
        expect(processors).toHaveLength(1);
        expect(processors?.[0]).toBeInstanceOf(SensitiveDataFilter);
      });

      it('should respect sensitiveDataFilter=false under the deprecated default config', async () => {
        observability = new Observability({
          default: { enabled: true },
          sensitiveDataFilter: false,
        });

        const defaultInstance = observability.getInstance('default');
        expect(defaultInstance?.getSpanOutputProcessors()).toHaveLength(0);
      });

      it('should not modify pre-instantiated ObservabilityInstance values', () => {
        // Default ConsoleLogger level is ERROR, so warn() is a no-op. Spy on the
        // method itself so we can assert the call regardless of the level gate.
        const warnSpy = vi.spyOn(ConsoleLogger.prototype, 'warn').mockImplementation(() => {});

        const preBuilt = new DefaultObservabilityInstance({
          serviceName: 'pre-built',
          name: 'pre-built',
          sampling: { type: SamplingStrategyType.ALWAYS },
          exporters: [new TestExporter()],
          spanOutputProcessors: [],
        });

        observability = new Observability({
          configs: {
            preBuilt,
          },
        });

        // Pre-built instance is registered as-is, no auto-injected filter.
        const registered = observability.getInstance('preBuilt');
        expect(registered).toBe(preBuilt);
        expect(registered?.getSpanOutputProcessors()).toHaveLength(0);

        // With auto-apply enabled (default) and no filter present, a warning is logged.
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Pre-instantiated observability instance does not include a SensitiveDataFilter'),
          expect.objectContaining({ instanceName: 'preBuilt' }),
        );

        warnSpy.mockRestore();
      });

      it('should not warn for pre-instantiated instances when sensitiveDataFilter is disabled', () => {
        const warnSpy = vi.spyOn(ConsoleLogger.prototype, 'warn').mockImplementation(() => {});

        const preBuilt = new DefaultObservabilityInstance({
          serviceName: 'pre-built',
          name: 'pre-built',
          sampling: { type: SamplingStrategyType.ALWAYS },
          exporters: [new TestExporter()],
          spanOutputProcessors: [],
        });

        observability = new Observability({
          configs: { preBuilt },
          sensitiveDataFilter: false,
        });

        expect(warnSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('Pre-instantiated observability instance does not include a SensitiveDataFilter'),
          expect.anything(),
        );

        warnSpy.mockRestore();
      });
    });

    it('should handle MastraPlatformExporter gracefully when token is missing', async () => {
      // Empty string is treated as "missing" by the exporter; using vi.stubEnv
      // keeps Vitest's env restoration intact so the suite-level afterEach
      // can roll it back without leaking the test value into later tests.
      vi.stubEnv('MASTRA_CLOUD_ACCESS_TOKEN', '');

      const logger = new ConsoleLogger({ level: LogLevel.DEBUG });

      // Spy on console to check for disabled message
      // Note: ConsoleLogger.debug() calls console.info() internally
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      // MastraPlatformExporter should not throw, but log debug message instead
      const exporter = new MastraPlatformExporter({ logger });

      // Verify debug message was logged with exporter name
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'mastra-platform-exporter disabled: MASTRA_CLOUD_ACCESS_TOKEN environment variable not set',
        ),
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

      infoSpy.mockRestore();
    });
  });
});
