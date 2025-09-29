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
    it('should configure Laminar with team ID', () => {
      const config = resolveProviderConfig({
        laminar: {
          apiKey: 'test-key',
          teamId: 'test-team',
        },
      });

      expect(config?.endpoint).toBe('https://api.lmnr.ai/v1/traces');
      expect(config?.headers['Authorization']).toBe('Bearer test-key');
      expect(config?.headers['x-laminar-team-id']).toBe('test-team');
      expect(config?.protocol).toBe('http/protobuf');
    });

    it('should require both apiKey and teamId', () => {
      const config = resolveProviderConfig({
        laminar: {
          // apiKey missing
          teamId: 'test-team',
        },
      });

      expect(config).toBeNull();
    });
  });

  describe('Custom', () => {
    it('should configure custom provider', () => {
      const config = resolveProviderConfig({
        custom: {
          endpoint: 'https://my-collector.example.com',
          headers: { 'x-api-key': 'test' },
          protocol: 'http/protobuf',
        },
      });

      expect(config?.endpoint).toBe('https://my-collector.example.com');
      expect(config?.headers['x-api-key']).toBe('test');
      expect(config?.protocol).toBe('http/protobuf');
    });

    it('should require endpoint for custom provider', () => {
      const config = resolveProviderConfig({
        custom: {
          headers: { 'x-api-key': 'test' },
        },
      });

      expect(config).toBeNull();
    });
  });
});
