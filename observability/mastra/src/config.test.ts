import { MastraError } from '@mastra/core/error';
import { describe, it, expect } from 'vitest';
import { SamplingStrategyType } from './config';
import { Observability } from './default';

describe('Observability Config Validation', () => {
  describe('ObservabilityRegistryConfig validation', () => {
    it('should accept empty config', () => {
      expect(() => {
        new Observability({});
      }).not.toThrow();
    });

    it('should accept config with only default', () => {
      expect(() => {
        new Observability({
          default: {
            enabled: true,
          },
        });
      }).not.toThrow();
    });

    it('should accept config with only configs', () => {
      expect(() => {
        new Observability({
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: { type: SamplingStrategyType.ALWAYS },
            },
          },
        });
      }).not.toThrow();
    });

    it('should reject config with default enabled and any configs', () => {
      // default and configs are mutually exclusive when default is enabled
      try {
        new Observability({
          default: {
            enabled: true,
          },
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: { type: SamplingStrategyType.ALWAYS },
            },
          },
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(MastraError);
        if (error instanceof MastraError) {
          expect(error.id).toBe('OBSERVABILITY_INVALID_CONFIG');
          expect(error.domain).toBe('MASTRA_OBSERVABILITY');
          expect(error.category).toBe('USER');
          expect(error.message).toContain('Cannot specify both "default"');
          expect(error.message).toContain('configs');
        }
      }
    });

    it('should accept config with default disabled and configs', () => {
      // When default.enabled is false (or undefined), having configs is allowed
      expect(() => {
        new Observability({
          default: {
            enabled: false,
          },
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: { type: SamplingStrategyType.ALWAYS },
            },
          },
        });
      }).not.toThrow();
    });

    it('should accept config with empty configs object', () => {
      // Empty configs object should not trigger the validation error
      expect(() => {
        new Observability({
          default: {
            enabled: true,
          },
          configs: {},
        });
      }).not.toThrow();
    });

    it('should accept config with only configSelector', () => {
      expect(() => {
        new Observability({
          configSelector: () => 'default',
        });
      }).not.toThrow();
    });

    it('should accept single config without configSelector', () => {
      expect(() => {
        new Observability({
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: { type: SamplingStrategyType.ALWAYS },
            },
          },
        });
      }).not.toThrow();
    });

    it('should require configSelector when configs has more than one config', () => {
      try {
        new Observability({
          configs: {
            config1: {
              serviceName: 'service-1',
              sampling: { type: SamplingStrategyType.ALWAYS },
            },
            config2: {
              serviceName: 'service-2',
              sampling: { type: SamplingStrategyType.ALWAYS },
            },
          },
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(MastraError);
        if (error instanceof MastraError) {
          expect(error.id).toBe('OBSERVABILITY_INVALID_CONFIG');
          expect(error.domain).toBe('MASTRA_OBSERVABILITY');
          expect(error.category).toBe('USER');
          expect(error.message).toContain('configSelector');
          expect(error.message).toContain('multiple configs');
        }
      }
    });

    it('should accept multiple configs with configSelector', () => {
      expect(() => {
        new Observability({
          configs: {
            config1: {
              serviceName: 'service-1',
              sampling: { type: SamplingStrategyType.ALWAYS },
            },
            config2: {
              serviceName: 'service-2',
              sampling: { type: SamplingStrategyType.ALWAYS },
            },
          },
          configSelector: () => 'config1',
        });
      }).not.toThrow();
    });
  });

  describe('SamplingStrategy validation', () => {
    it('should accept valid RATIO probability', () => {
      expect(() => {
        new Observability({
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: { type: SamplingStrategyType.RATIO, probability: 0.5 },
            },
          },
        });
      }).not.toThrow();
    });

    it('should reject RATIO with probability > 1', () => {
      try {
        new Observability({
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: { type: SamplingStrategyType.RATIO, probability: 1.5 },
            },
          },
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(MastraError);
        if (error instanceof MastraError) {
          expect(error.id).toBe('OBSERVABILITY_INVALID_INSTANCE_CONFIG');
          expect(error.domain).toBe('MASTRA_OBSERVABILITY');
          expect(error.category).toBe('USER');
          expect(error.message).toContain('myTracing');
          expect(error.message).toContain('Probability must be between 0 and 1');
        }
      }
    });

    it('should reject RATIO with negative probability', () => {
      try {
        new Observability({
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: { type: SamplingStrategyType.RATIO, probability: -0.5 },
            },
          },
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(MastraError);
        if (error instanceof MastraError) {
          expect(error.id).toBe('OBSERVABILITY_INVALID_INSTANCE_CONFIG');
          expect(error.message).toContain('Probability must be between 0 and 1');
        }
      }
    });

    it('should accept ALWAYS sampling strategy', () => {
      expect(() => {
        new Observability({
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: { type: SamplingStrategyType.ALWAYS },
            },
          },
        });
      }).not.toThrow();
    });

    it('should accept NEVER sampling strategy', () => {
      expect(() => {
        new Observability({
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: { type: SamplingStrategyType.NEVER },
            },
          },
        });
      }).not.toThrow();
    });

    it('should accept CUSTOM sampling strategy with function', () => {
      expect(() => {
        new Observability({
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: {
                type: SamplingStrategyType.CUSTOM,
                sampler: () => true,
              },
            },
          },
        });
      }).not.toThrow();
    });
  });

  describe('ObservabilityInstanceConfig validation', () => {
    it('should accept valid instance config', () => {
      expect(() => {
        new Observability({
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: { type: SamplingStrategyType.ALWAYS },
              includeInternalSpans: true,
              requestContextKeys: ['userId', 'sessionId'],
            },
          },
        });
      }).not.toThrow();
    });

    it('should reject config without serviceName', () => {
      try {
        new Observability({
          configs: {
            myTracing: {
              // @ts-expect-error - testing invalid config
              sampling: { type: SamplingStrategyType.ALWAYS },
            },
          },
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(MastraError);
        if (error instanceof MastraError) {
          expect(error.id).toBe('OBSERVABILITY_INVALID_INSTANCE_CONFIG');
          expect(error.domain).toBe('MASTRA_OBSERVABILITY');
          expect(error.category).toBe('USER');
          expect(error.message).toContain('myTracing');
          expect(error.message).toContain('serviceName');
          expect(error.message).toContain('Required');
        }
      }
    });
  });
});
