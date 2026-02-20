import { describe, it, expect } from 'vitest';
import { resolveProviderConfig } from './provider-configs';

describe('Provider Configurations', () => {
  describe('SigNoz', () => {
    it('should configure SigNoz with cloud endpoint', () => {
      const config = resolveProviderConfig({
        signoz: {
          apiKey: 'test-key',
          region: 'us',
        },
      });

      expect(config?.endpoint).toBe('https://ingest.us.signoz.cloud:443/v1/traces');
      expect(config?.headers['signoz-ingestion-key']).toBe('test-key');
      expect(config?.protocol).toBe('http/protobuf');
    });

    it('should handle self-hosted SigNoz', () => {
      const config = resolveProviderConfig({
        signoz: {
          apiKey: 'test-key',
          endpoint: 'https://my-signoz.example.com',
        },
      });

      expect(config?.endpoint).toBe('https://my-signoz.example.com');
      expect(config?.headers['signoz-ingestion-key']).toBe('test-key');
    });
  });

  describe('Dash0', () => {
    it('should configure Dash0 with proper headers', () => {
      const config = resolveProviderConfig({
        dash0: {
          apiKey: 'test-key',
          endpoint: 'ingress.us-west-2.aws.dash0.com:4317',
          dataset: 'production',
        },
      });

      expect(config?.endpoint).toBe('ingress.us-west-2.aws.dash0.com:4317/v1/traces');
      expect(config?.headers['authorization']).toBe('Bearer test-key');
      expect(config?.headers['dash0-dataset']).toBe('production');
      expect(config?.protocol).toBe('grpc');
    });
  });

  describe('New Relic', () => {
    it('should configure New Relic with default endpoint', () => {
      const config = resolveProviderConfig({
        newrelic: {
          apiKey: 'test-license-key',
        },
      });

      expect(config?.endpoint).toBe('https://otlp.nr-data.net:443/v1/traces');
      expect(config?.headers['api-key']).toBe('test-license-key');
      expect(config?.protocol).toBe('http/protobuf');
    });
  });

  describe('Traceloop', () => {
    it('should configure Traceloop with destination ID', () => {
      const config = resolveProviderConfig({
        traceloop: {
          apiKey: 'test-key',
          destinationId: 'my-destination',
        },
      });

      expect(config?.endpoint).toBe('https://api.traceloop.com/v1/traces');
      expect(config?.headers['Authorization']).toBe('Bearer test-key');
      expect(config?.headers['x-traceloop-destination-id']).toBe('my-destination');
      expect(config?.protocol).toBe('http/json');
    });
  });

  describe('Laminar', () => {
    it('should configure Laminar', () => {
      const config = resolveProviderConfig({
        laminar: {
          apiKey: 'test-key',
        },
      });

      expect(config?.endpoint).toBe('https://api.lmnr.ai/v1/traces');
      expect(config?.headers['Authorization']).toBe('Bearer test-key');
      expect(config?.protocol).toBe('http/protobuf');
    });

    it('should require apiKey', () => {
      // Clear env var to ensure config validation fails
      const originalApiKey = process.env.LMNR_PROJECT_API_KEY;
      delete process.env.LMNR_PROJECT_API_KEY;
      try {
        const config = resolveProviderConfig({
          laminar: {},
        });

        expect(config).toBeNull();
      } finally {
        if (originalApiKey !== undefined) process.env.LMNR_PROJECT_API_KEY = originalApiKey;
      }
    });
  });

  describe('Grafana Cloud', () => {
    it('should configure Grafana Cloud with basic auth', () => {
      const config = resolveProviderConfig({
        grafanaCloud: {
          instanceId: '1235678',
          apiToken: 'glc_eyJvIjoiM',
          endpoint: 'https://otlp-gateway-prod-us-east-3.grafana.net/otlp',
        },
      });

      const expectedAuth = Buffer.from('1235678:glc_eyJvIjoiM').toString('base64');
      expect(config?.endpoint).toBe('https://otlp-gateway-prod-us-east-3.grafana.net/otlp/v1/traces');
      expect(config?.headers['Authorization']).toBe(`Basic ${expectedAuth}`);
      expect(config?.protocol).toBe('http/json');
    });

    it('should strip trailing slash from endpoint before appending path', () => {
      const config = resolveProviderConfig({
        grafanaCloud: {
          instanceId: '1235678',
          apiToken: 'glc_eyJvIjoiM',
          endpoint: 'https://otlp-gateway-prod-us-east-3.grafana.net/otlp/',
        },
      });

      expect(config?.endpoint).toBe('https://otlp-gateway-prod-us-east-3.grafana.net/otlp/v1/traces');
    });

    it('should not append /v1/traces if already present', () => {
      const config = resolveProviderConfig({
        grafanaCloud: {
          instanceId: '1235678',
          apiToken: 'glc_eyJvIjoiM',
          endpoint: 'https://otlp-gateway-prod-us-east-3.grafana.net/otlp/v1/traces',
        },
      });

      expect(config?.endpoint).toBe('https://otlp-gateway-prod-us-east-3.grafana.net/otlp/v1/traces');
    });

    it('should require instanceId', () => {
      const original = process.env.GRAFANA_CLOUD_INSTANCE_ID;
      delete process.env.GRAFANA_CLOUD_INSTANCE_ID;
      try {
        const config = resolveProviderConfig({
          grafanaCloud: {
            apiToken: 'glc_eyJvIjoiM',
            endpoint: 'https://otlp-gateway-prod-us-east-3.grafana.net/otlp',
          },
        });
        expect(config).toBeNull();
      } finally {
        if (original !== undefined) process.env.GRAFANA_CLOUD_INSTANCE_ID = original;
      }
    });

    it('should require apiToken', () => {
      const original = process.env.GRAFANA_CLOUD_API_TOKEN;
      delete process.env.GRAFANA_CLOUD_API_TOKEN;
      try {
        const config = resolveProviderConfig({
          grafanaCloud: {
            instanceId: '1235678',
            endpoint: 'https://otlp-gateway-prod-us-east-3.grafana.net/otlp',
          },
        });
        expect(config).toBeNull();
      } finally {
        if (original !== undefined) process.env.GRAFANA_CLOUD_API_TOKEN = original;
      }
    });

    it('should require endpoint', () => {
      const original = process.env.GRAFANA_CLOUD_OTLP_ENDPOINT;
      delete process.env.GRAFANA_CLOUD_OTLP_ENDPOINT;
      try {
        const config = resolveProviderConfig({
          grafanaCloud: {
            instanceId: '1235678',
            apiToken: 'glc_eyJvIjoiM',
          },
        });
        expect(config).toBeNull();
      } finally {
        if (original !== undefined) process.env.GRAFANA_CLOUD_OTLP_ENDPOINT = original;
      }
    });
  });

  describe('Custom', () => {
    it('should configure custom provider', () => {
      const config = resolveProviderConfig({
        custom: {
          endpoint: 'https://my-collector.example.com',
          headers: { 'x-value': 'test' },
          protocol: 'http/protobuf',
        },
      });

      expect(config?.endpoint).toBe('https://my-collector.example.com');
      expect(config?.headers['x-value']).toBe('test');
      expect(config?.protocol).toBe('http/protobuf');
    });

    it('should require endpoint for custom provider', () => {
      const config = resolveProviderConfig({
        custom: {
          headers: { 'x-value': 'test' },
        },
      });

      expect(config).toBeNull();
    });
  });
});
