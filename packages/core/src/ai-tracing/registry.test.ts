import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleLogger, LogLevel } from '../logger';
import { CloudExporter, DefaultExporter } from './exporters';
import {
  clearAITracingRegistry,
  getAITracing,
  registerAITracing,
  unregisterAITracing,
  hasAITracing,
  getDefaultAITracing,
  getSelectedAITracing,
  setupAITracing,
  shutdownAITracingRegistry,
  setSelector,
} from './registry';
import { SensitiveDataFilter } from './span_processors';
import { DefaultAITracing, BaseAITracing } from './tracers';
import type { AISpan, CreateSpanOptions, ConfigSelector, ConfigSelectorOptions, TracingConfig } from './types';
import { AISpanType, SamplingStrategyType, AITracingEventType } from './types';

describe('AI Tracing Registry', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Clear registry
    clearAITracingRegistry();
  });

  afterEach(async () => {
    await shutdownAITracingRegistry();
  });

  describe('Registry', () => {
    it('should register and retrieve tracing instances', () => {
      const tracing = new DefaultAITracing({
        serviceName: 'registry-test',
        name: 'registry-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      registerAITracing('my-tracing', tracing);

      expect(getAITracing('my-tracing')).toBe(tracing);
    });

    it('should clear registry', () => {
      const tracing = new DefaultAITracing({
        serviceName: 'registry-test',
        name: 'registry-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });
      registerAITracing('test', tracing);

      clearAITracingRegistry();

      expect(getAITracing('test')).toBeUndefined();
    });

    it('should handle multiple instances', () => {
      const tracing1 = new DefaultAITracing({
        serviceName: 'test-1',
        name: 'instance-1',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });
      const tracing2 = new DefaultAITracing({
        serviceName: 'test-2',
        name: 'instance-2',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      registerAITracing('first', tracing1);
      registerAITracing('second', tracing2);

      expect(getAITracing('first')).toBe(tracing1);
      expect(getAITracing('second')).toBe(tracing2);
    });

    it('should prevent duplicate registration', () => {
      const tracing1 = new DefaultAITracing({
        serviceName: 'test-1',
        name: 'instance-1',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });
      const tracing2 = new DefaultAITracing({
        serviceName: 'test-2',
        name: 'instance-2',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      registerAITracing('duplicate', tracing1);

      expect(() => {
        registerAITracing('duplicate', tracing2);
      }).toThrow("AI Tracing instance 'duplicate' already registered");
    });

    it('should unregister instances correctly', () => {
      const tracing = new DefaultAITracing({
        serviceName: 'test-1',
        name: 'instance-1',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      registerAITracing('test', tracing);
      expect(getAITracing('test')).toBe(tracing);

      expect(unregisterAITracing('test')).toBe(true);
      expect(getAITracing('test')).toBeUndefined();
    });

    it('should return false when unregistering non-existent instance', () => {
      expect(unregisterAITracing('non-existent')).toBe(false);
    });

    it('should handle hasAITracing checks correctly', () => {
      const enabledTracing = new DefaultAITracing({
        serviceName: 'enabled-test',
        name: 'enabled-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });
      const disabledTracing = new DefaultAITracing({
        serviceName: 'disabled-test',
        name: 'disabled-instance',
        sampling: { type: SamplingStrategyType.NEVER },
      });

      registerAITracing('enabled', enabledTracing);
      registerAITracing('disabled', disabledTracing);

      expect(hasAITracing('enabled')).toBe(true);
      expect(hasAITracing('disabled')).toBe(false);
      expect(hasAITracing('non-existent')).toBe(false);
    });

    it('should access tracing config through registry', () => {
      const tracing = new DefaultAITracing({
        serviceName: 'config-test',
        name: 'config-instance',
        sampling: { type: SamplingStrategyType.RATIO, probability: 0.5 },
      });

      registerAITracing('config-test', tracing);
      const retrieved = getAITracing('config-test');

      expect(retrieved).toBeDefined();
      expect(retrieved!.getConfig().serviceName).toBe('config-test');
      expect(retrieved!.getConfig().sampling.type).toBe(SamplingStrategyType.RATIO);
    });

    it('should use selector function when provided', () => {
      const tracing1 = new DefaultAITracing({
        serviceName: 'console-tracing',
        name: 'console-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });
      const tracing2 = new DefaultAITracing({
        serviceName: 'langfuse-tracing',
        name: 'langfuse-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      registerAITracing('console', tracing1);
      registerAITracing('langfuse', tracing2);

      const selector: ConfigSelector = (context, _availableTracers) => {
        // For testing, we'll simulate routing based on runtime context
        if (context.runtimeContext?.['environment'] === 'production') return 'langfuse';
        if (context.runtimeContext?.['environment'] === 'development') return 'console';
        return undefined; // Fall back to default
      };

      setSelector(selector);

      const prodOptions: ConfigSelectorOptions = {
        runtimeContext: { environment: 'production' } as any,
      };

      const devOptions: ConfigSelectorOptions = {
        runtimeContext: { environment: 'development' } as any,
      };

      expect(getSelectedAITracing(prodOptions)).toBe(tracing2); // langfuse
      expect(getSelectedAITracing(devOptions)).toBe(tracing1); // console
    });

    it('should fall back to default when selector returns invalid name', () => {
      const tracing1 = new DefaultAITracing({
        serviceName: 'default-tracing',
        name: 'default-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      registerAITracing('default', tracing1, true); // Explicitly set as default

      const selector: ConfigSelector = (_context, _availableTracers) => 'non-existent';
      setSelector(selector);

      const options: ConfigSelectorOptions = {
        runtimeContext: undefined,
      };

      expect(getSelectedAITracing(options)).toBe(tracing1); // Falls back to default
    });

    it('should handle default tracing behavior', () => {
      const tracing1 = new DefaultAITracing({
        serviceName: 'first-tracing',
        name: 'first-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });
      const tracing2 = new DefaultAITracing({
        serviceName: 'second-tracing',
        name: 'second-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      // First registered becomes default automatically
      registerAITracing('first', tracing1);
      registerAITracing('second', tracing2);

      expect(getDefaultAITracing()).toBe(tracing1);

      // Explicitly set second as default
      registerAITracing('third', tracing2, true);
      expect(getDefaultAITracing()).toBe(tracing2);
    });
  });

  describe('Mastra Integration', () => {
    it('should configure AI tracing with simple config', async () => {
      const tracingConfig: TracingConfig = {
        serviceName: 'test-service',
        name: 'test-instance',
        exporters: [],
      };

      setupAITracing({
        configs: {
          test: tracingConfig,
        },
      });

      // Verify AI tracing was registered and set as default
      const tracing = getAITracing('test');
      expect(tracing).toBeDefined();
      expect(tracing?.getConfig().serviceName).toBe('test-service');
      expect(tracing?.getConfig().sampling?.type).toBe(SamplingStrategyType.ALWAYS); // Should default to ALWAYS
      expect(getDefaultAITracing()).toBe(tracing); // First one becomes default
    });

    it('should use ALWAYS sampling by default when sampling is not specified', async () => {
      const tracingConfig: TracingConfig = {
        serviceName: 'default-sampling-test',
        name: 'default-sampling-instance',
      };

      setupAITracing({
        configs: {
          test: tracingConfig,
        },
      });

      const tracing = getAITracing('test');
      expect(tracing?.getConfig().sampling?.type).toBe(SamplingStrategyType.ALWAYS);
    });

    it('should configure AI tracing with custom implementation', async () => {
      class CustomAITracing extends BaseAITracing {
        protected createSpan<TType extends AISpanType>(options: CreateSpanOptions<TType>): AISpan<TType> {
          // Custom implementation - just return a mock span for testing
          return {
            id: 'custom-span-id',
            name: options.name,
            type: options.type,
            attributes: options.attributes,
            parent: options.parent,
            traceId: 'custom-trace-id',
            startTime: new Date(),
            aiTracing: this,
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
          } as AISpan<TType>;
        }
      }

      const customInstance = new CustomAITracing({
        serviceName: 'custom-service',
        name: 'custom-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      setupAITracing({
        configs: {
          custom: customInstance,
        },
      });

      // Verify custom implementation was registered
      const tracing = getAITracing('custom');
      expect(tracing).toBeDefined();
      expect(tracing).toBe(customInstance);
      expect(tracing?.getConfig().serviceName).toBe('custom-service');
    });

    it('should support mixed configuration (config + instance)', async () => {
      class CustomAITracing extends BaseAITracing {
        protected createSpan<TType extends AISpanType>(_options: CreateSpanOptions<TType>): AISpan<TType> {
          return {} as AISpan<TType>; // Mock implementation
        }
      }

      const customInstance = new CustomAITracing({
        serviceName: 'custom-service',
        name: 'custom-instance',
        sampling: { type: SamplingStrategyType.NEVER },
      });

      setupAITracing({
        configs: {
          standard: {
            serviceName: 'standard-service',
            exporters: [],
          },
          custom: customInstance,
        },
      });

      // Verify both instances were registered
      const standardTracing = getAITracing('standard');
      const customTracing = getAITracing('custom');

      expect(standardTracing).toBeDefined();
      expect(standardTracing).toBeInstanceOf(DefaultAITracing);
      expect(standardTracing?.getConfig().serviceName).toBe('standard-service');

      expect(customTracing).toBeDefined();
      expect(customTracing).toBe(customInstance);
      expect(customTracing?.getConfig().serviceName).toBe('custom-service');
    });

    it('should handle registry shutdown during Mastra shutdown', async () => {
      let shutdownCalled = false;

      class TestAITracing extends BaseAITracing {
        protected createSpan<TType extends AISpanType>(_options: CreateSpanOptions<TType>): AISpan<TType> {
          return {} as AISpan<TType>;
        }

        async shutdown(): Promise<void> {
          shutdownCalled = true;
          await super.shutdown();
        }
      }

      const testInstance = new TestAITracing({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      });

      setupAITracing({
        configs: {
          test: testInstance,
        },
      });

      // Verify instance is registered
      expect(getAITracing('test')).toBe(testInstance);

      // Shutdown should call instance shutdown and clear registry
      await shutdownAITracingRegistry();

      expect(shutdownCalled).toBe(true);
      expect(getAITracing('test')).toBeUndefined();
    });

    it('should prevent duplicate registration across multiple Mastra instances', () => {
      const tracingConfig: TracingConfig = {
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
      };

      setupAITracing({
        configs: {
          duplicate: tracingConfig,
        },
      });

      // Attempting to register the same name should throw
      expect(() => {
        setupAITracing({
          configs: {
            duplicate: tracingConfig,
          },
        });
      }).toThrow("AI Tracing instance 'duplicate' already registered");
    });

    it('should support selector function configuration', async () => {
      const selector: ConfigSelector = (context, _availableTracers) => {
        if (context.runtimeContext?.['service'] === 'agent') return 'langfuse';
        if (context.runtimeContext?.['service'] === 'workflow') return 'datadog';
        return undefined; // Use default
      };

      setupAITracing({
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
        runtimeContext: { service: 'agent' } as any,
      };

      const workflowOptions: ConfigSelectorOptions = {
        runtimeContext: { service: 'workflow' } as any,
      };

      const genericOptions: ConfigSelectorOptions = {
        runtimeContext: undefined,
      };

      // Verify selector routes correctly
      expect(getSelectedAITracing(agentOptions)).toBe(getAITracing('langfuse'));
      expect(getSelectedAITracing(workflowOptions)).toBe(getAITracing('datadog'));
      expect(getSelectedAITracing(genericOptions)).toBe(getDefaultAITracing()); // Falls back to default (console)
    });
  });

  describe('setupAITracing edge cases', () => {
    it('should handle config.configs being undefined', () => {
      expect(() => {
        setupAITracing({
          default: { enabled: false },
          // configs is undefined
        });
      }).not.toThrow();
    });

    it('should handle config.configs being empty array', () => {
      expect(() => {
        setupAITracing({
          default: { enabled: false },
          configs: [] as any, // Empty array instead of object
        });
      }).not.toThrow();
    });

    it('should handle config.configs being undefined with default enabled', () => {
      expect(() => {
        setupAITracing({
          default: { enabled: true },
          // configs is undefined - should not throw "Cannot read properties of undefined"
        });
      }).not.toThrow();

      // Should still create the default instance
      const defaultInstance = getAITracing('default');
      expect(defaultInstance).toBeDefined();
    });

    it('should handle empty configs object', () => {
      expect(() => {
        setupAITracing({
          default: { enabled: false },
          configs: {}, // Empty object
        });
      }).not.toThrow();
    });

    it('should handle minimal config with just selector', () => {
      const selector: ConfigSelector = () => undefined;

      expect(() => {
        setupAITracing({
          configSelector: selector,
          // No default, no configs
        });
      }).not.toThrow();
    });

    it('should handle config with null configs property', () => {
      expect(() => {
        setupAITracing({
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
        setupAITracing({
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
        setupAITracing({
          default: { enabled: false },
          // configs intentionally undefined to test the original bug
        });
      }).not.toThrow();
    });

    it('should handle when entire config is undefined', () => {
      expect(() => {
        setupAITracing(undefined as any);
      }).not.toThrow();
    });

    it('should handle when entire config is empty object', () => {
      expect(() => {
        setupAITracing({});
      }).not.toThrow();
    });

    it('should handle when default property is undefined', () => {
      expect(() => {
        setupAITracing({
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
        setupAITracing({
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
        setupAITracing({
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
        setupAITracing({
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
        setupAITracing({
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
      setupAITracing({
        default: { enabled: true },
        configs: {},
      });

      const defaultInstance = getAITracing('default');
      expect(defaultInstance).toBeDefined();
      expect(defaultInstance?.getConfig().serviceName).toBe('mastra');
      expect(defaultInstance?.getConfig().sampling.type).toBe(SamplingStrategyType.ALWAYS);

      // Verify it's set as the default
      expect(getDefaultAITracing()).toBe(defaultInstance);

      // Verify exporters
      const exporters = defaultInstance?.getExporters();
      expect(exporters).toHaveLength(2);
      expect(exporters?.[0]).toBeInstanceOf(DefaultExporter);
      expect(exporters?.[1]).toBeInstanceOf(CloudExporter);

      // Verify processors
      const processors = defaultInstance?.getProcessors();
      expect(processors).toHaveLength(1);
      expect(processors?.[0]).toBeInstanceOf(SensitiveDataFilter);
    });

    it('should not create default config when disabled', async () => {
      setupAITracing({
        default: { enabled: false },
        configs: {
          custom: {
            serviceName: 'custom-service',
            exporters: [],
          },
        },
      });

      const defaultInstance = getAITracing('default');
      expect(defaultInstance).toBeUndefined();

      // Custom config should be the default
      const customInstance = getAITracing('custom');
      expect(getDefaultAITracing()).toBe(customInstance);
    });

    it('should not create default config when default property is not provided', async () => {
      setupAITracing({
        configs: {
          custom: {
            serviceName: 'custom-service',
            exporters: [],
          },
        },
      });

      const defaultInstance = getAITracing('default');
      expect(defaultInstance).toBeUndefined();
    });

    it('should throw error when custom config named "default" conflicts with default config', () => {
      expect(() => {
        setupAITracing({
          default: { enabled: true },
          configs: {
            default: {
              serviceName: 'my-custom-default',
              exporters: [],
            },
          },
        });
      }).toThrow("Cannot use 'default' as a custom config name when default tracing is enabled");
    });

    it('should allow custom config named "default" when default config is disabled', async () => {
      setupAITracing({
        default: { enabled: false },
        configs: {
          default: {
            serviceName: 'my-custom-default',
            exporters: [],
          },
        },
      });

      const defaultInstance = getAITracing('default');
      expect(defaultInstance).toBeDefined();
      expect(defaultInstance?.getConfig().serviceName).toBe('my-custom-default');
    });

    it('should work with both default and custom configs', async () => {
      setupAITracing({
        default: { enabled: true },
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
      });

      // Default config should exist
      const defaultInstance = getAITracing('default');
      expect(defaultInstance).toBeDefined();
      expect(defaultInstance?.getConfig().serviceName).toBe('mastra');

      // Default should be the default instance
      expect(getDefaultAITracing()).toBe(defaultInstance);

      // Custom configs should also exist
      const custom1 = getAITracing('custom1');
      expect(custom1).toBeDefined();
      expect(custom1?.getConfig().serviceName).toBe('custom-service-1');

      const custom2 = getAITracing('custom2');
      expect(custom2).toBeDefined();
      expect(custom2?.getConfig().serviceName).toBe('custom-service-2');
    });

    it('should work with selector when default config is enabled', async () => {
      const selector: ConfigSelector = (context, _availableTracers) => {
        if (context.runtimeContext?.['useDefault'] === true) return 'default';
        return 'custom';
      };

      setupAITracing({
        default: { enabled: true },
        configs: {
          custom: {
            serviceName: 'custom-service',
            exporters: [],
          },
        },
        configSelector: selector,
      });

      const defaultOptions: ConfigSelectorOptions = {
        runtimeContext: { useDefault: true } as any,
      };

      const customOptions: ConfigSelectorOptions = {
        runtimeContext: { useDefault: false } as any,
      };

      // Should route to default config
      expect(getSelectedAITracing(defaultOptions)).toBe(getAITracing('default'));

      // Should route to custom config
      expect(getSelectedAITracing(customOptions)).toBe(getAITracing('custom'));
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
        expect.stringContaining('mastra-cloud-ai-tracing-exporter disabled: MASTRA_CLOUD_ACCESS_TOKEN environment variable not set'),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sign up for Mastra Cloud at https://cloud.mastra.ai'),
      );

      // Verify exporter is disabled but doesn't throw
      const event = {
        type: AITracingEventType.SPAN_ENDED,
        span: {
          id: 'test-span',
          traceId: 'test-trace',
          name: 'test',
          type: AISpanType.GENERIC,
          startTime: new Date(),
          endTime: new Date(),
        } as any,
        serviceName: 'test',
        instanceName: 'test',
        timestamp: new Date(),
      };

      // Should not throw when exporting
      await expect(exporter.exportEvent(event)).resolves.not.toThrow();

      // Restore mocks
      infoSpy.mockRestore();
      if (originalToken) {
        process.env.MASTRA_CLOUD_ACCESS_TOKEN = originalToken;
      }
    });
  });
});
