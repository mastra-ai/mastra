import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  describe('Custom', () => {
    beforeEach(() => {
      vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', undefined);
      vi.stubEnv('OTEL_EXPORTER_OTLP_LOGS_ENDPOINT', undefined);
    });
    afterEach(() => vi.unstubAllEnvs());

    it('does not use OTLP environment endpoints for Zipkin', () => {
      vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', 'https://collector.example.com/traces');
      expect(resolveProviderConfig({ custom: { protocol: 'zipkin' } })).toBeNull();
    });

    it('rejects an empty explicit endpoint map even when environment endpoints exist', () => {
      vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', 'https://collector.example.com/traces');
      // @ts-expect-error Verify invalid JavaScript configuration is not rescued by environment values.
      expect(resolveProviderConfig({ custom: { endpoints: {} } })).toBeNull();
    });

    it('treats empty environment variables as unset', () => {
      vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', '');
      vi.stubEnv('OTEL_EXPORTER_OTLP_LOGS_ENDPOINT', '');
      expect(resolveProviderConfig({ custom: {} })).toBeNull();
    });

    it.each(['https://collector.example.com', ''])('rejects both endpoint and endpoints (%s)', endpoint => {
      expect(
        resolveProviderConfig({
          // @ts-expect-error These options are mutually exclusive, including for JavaScript callers.
          custom: { endpoint, endpoints: { traces: 'https://collector.example.com/traces' } },
        }),
      ).toBeNull();
    });

    it('rejects an empty endpoints configuration', () => {
      // @ts-expect-error At least one signal is required; verify runtime validation for JavaScript callers.
      expect(resolveProviderConfig({ custom: { endpoints: {} } })).toBeNull();
    });

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

    it('should require an endpoint for custom provider', () => {
      const config = resolveProviderConfig({
        custom: {
          headers: { 'x-value': 'test' },
        },
      });

      expect(config).toBeNull();
    });
  });
});
