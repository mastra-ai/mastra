import { describe, it, expect } from 'vitest';
import { Observability } from './default';
import { SamplingStrategyType } from './config';

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

    it('should reject config with both default and configs', () => {
      expect(() => {
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
      }).toThrow('Cannot specify both "default" and "configs"');
    });

    it('should accept config with default disabled and configs', () => {
      // Even if default.enabled is false, having default present counts as having default
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
      }).toThrow('Cannot specify both "default" and "configs"');
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
      expect(() => {
        new Observability({
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: { type: SamplingStrategyType.RATIO, probability: 1.5 },
            },
          },
        });
      }).toThrow('Probability must be between 0 and 1');
    });

    it('should reject RATIO with negative probability', () => {
      expect(() => {
        new Observability({
          configs: {
            myTracing: {
              serviceName: 'my-service',
              sampling: { type: SamplingStrategyType.RATIO, probability: -0.5 },
            },
          },
        });
      }).toThrow('Probability must be between 0 and 1');
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
      expect(() => {
        new Observability({
          configs: {
            myTracing: {
              // @ts-expect-error - testing invalid config
              sampling: { type: SamplingStrategyType.ALWAYS },
            },
          },
        });
      }).toThrow();
    });
  });
});
