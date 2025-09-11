import { describe, it, expect } from 'vitest';
import { resolveProviderConfig } from './provider-configs';

describe('Provider Configurations', () => {
  describe('LangSmith', () => {
    it('should configure LangSmith with US endpoint by default', () => {
      const config = resolveProviderConfig({
        langsmith: {
          apiKey: 'test-key',
          projectName: 'test-project',
        },
      });

      expect(config?.endpoint).toBe('https://api.smith.langchain.com/v1/traces');
      expect(config?.headers['x-api-key']).toBe('test-key');
      expect(config?.headers['Langsmith-Project']).toBe('test-project');
      expect(config?.protocol).toBe('http/json');
    });

    it('should configure LangSmith with EU endpoint when region is eu', () => {
      const config = resolveProviderConfig({
        langsmith: {
          apiKey: 'test-key',
          region: 'eu',
        },
      });

      expect(config?.endpoint).toBe('https://eu.api.smith.langchain.com/v1/traces');
      expect(config?.headers['x-api-key']).toBe('test-key');
    });

    it('should handle self-hosted LangSmith endpoint', () => {
      const config = resolveProviderConfig({
        langsmith: {
          apiKey: 'test-key',
          endpoint: 'https://my-langsmith.example.com',
        },
      });

      expect(config?.endpoint).toBe('https://my-langsmith.example.com/api/v1/v1/traces');
      expect(config?.headers['x-api-key']).toBe('test-key');
    });

    it('should not duplicate /api/v1 for self-hosted endpoints', () => {
      const config = resolveProviderConfig({
        langsmith: {
          apiKey: 'test-key',
          endpoint: 'https://my-langsmith.example.com/api/v1',
        },
      });

      expect(config?.endpoint).toBe('https://my-langsmith.example.com/api/v1/v1/traces');
    });

    it('should handle official endpoint without modification', () => {
      const config = resolveProviderConfig({
        langsmith: {
          apiKey: 'test-key',
          endpoint: 'https://api.smith.langchain.com/otel',
        },
      });

      expect(config?.endpoint).toBe('https://api.smith.langchain.com/v1/traces');
    });

    it('should require API key at TypeScript level', () => {
      const config = resolveProviderConfig({
        langsmith: {
          // apiKey missing - should log error
        },
      });

      expect(config).toBeNull();
    });
  });

  describe('SigNoz', () => {
    it('should configure SigNoz with cloud endpoint', () => {
      const config = resolveProviderConfig({
        signoz: {
          apiKey: 'test-key',
          region: 'us',
        },
      });

      expect(config?.endpoint).toBe('https://ingest.us.signoz.cloud:443');
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
          region: 'us',
          dataset: 'production',
        },
      });

      expect(config?.endpoint).toBe('https://ingress.us.dash0.com');
      expect(config?.headers['Authorization']).toBe('Bearer test-key');
      expect(config?.headers['Dash0-Dataset']).toBe('production');
      expect(config?.protocol).toBe('http/protobuf');
    });
  });

  describe('New Relic', () => {
    it('should configure New Relic with default endpoint', () => {
      const config = resolveProviderConfig({
        newrelic: {
          apiKey: 'test-license-key',
        },
      });

      expect(config?.endpoint).toBe('https://otlp.nr-data.net:443');
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

      expect(config?.endpoint).toBe('https://api.traceloop.com');
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

      expect(config?.endpoint).toBe('https://api.lmnr.ai:8443');
      expect(config?.headers['Authorization']).toBe('Bearer test-key');
      expect(config?.headers['x-laminar-team-id']).toBe('test-team');
      expect(config?.protocol).toBe('grpc');
    });

    it('should require both apiKey and teamId', () => {
      const config = resolveProviderConfig({
        laminar: {
          apiKey: 'test-key',
          // teamId missing
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
