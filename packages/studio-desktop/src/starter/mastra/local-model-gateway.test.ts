import { afterEach, describe, expect, it } from 'vitest';
import { getDesktopBuilderConfig } from './desktop-builder';
import { DesktopLocalModelGateway, getDesktopModelConfig } from './local-model-gateway';
import { mastra } from './index';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getDesktopModelConfig', () => {
  describe('when the configured model URL is Ollama local', () => {
    it('uses the local Ollama provider id and configured model credentials', () => {
      process.env.MASTRA_DESKTOP_MODEL_URL = 'http://localhost:11434/v1';
      process.env.MASTRA_DESKTOP_MODEL_ID = 'llama3.2';
      process.env.MASTRA_DESKTOP_MODEL_API_KEY = 'ollama';

      expect(getDesktopModelConfig()).toEqual({
        apiKey: 'ollama',
        modelId: 'llama3.2',
        providerId: 'ollama',
        providerName: 'Ollama Local',
        url: 'http://localhost:11434/v1',
      });
    });
  });

  describe('when the configured model URL is LM Studio local', () => {
    it('uses the local LM Studio provider id', () => {
      process.env.MASTRA_DESKTOP_MODEL_URL = 'http://localhost:1234/v1';
      process.env.MASTRA_DESKTOP_MODEL_ID = 'loaded-model';
      process.env.MASTRA_DESKTOP_MODEL_API_KEY = 'not-needed';

      expect(getDesktopModelConfig()).toMatchObject({
        apiKey: 'not-needed',
        modelId: 'loaded-model',
        providerId: 'lmstudio',
        providerName: 'LM Studio Local',
      });
    });
  });
});

describe('DesktopLocalModelGateway', () => {
  describe('when the configured model URL is Ollama local', () => {
    it('claims local Ollama model ids without claiming Ollama Cloud', () => {
      process.env.MASTRA_DESKTOP_MODEL_URL = 'http://localhost:11434/v1';
      const gateway = new DesktopLocalModelGateway();

      expect(gateway.handlesModel('ollama/llama3.2')).toBe(true);
      expect(gateway.handlesModel('ollama-cloud/gpt-oss:120b')).toBe(false);
    });

    it('exposes the configured local Ollama model as a gateway provider', async () => {
      process.env.MASTRA_DESKTOP_MODEL_URL = 'http://localhost:11434/v1';
      process.env.MASTRA_DESKTOP_MODEL_ID = 'glm-ocr:latest';
      process.env.MASTRA_DESKTOP_MODEL_API_KEY = 'ollama';
      const gateway = new DesktopLocalModelGateway();

      await expect(gateway.fetchProviders()).resolves.toEqual({
        ollama: {
          apiKeyEnvVar: 'MASTRA_DESKTOP_MODEL_API_KEY',
          gateway: 'desktop-local',
          models: ['glm-ocr:latest'],
          name: 'Ollama Local',
        },
      });
    });
  });
});

describe('getDesktopBuilderConfig', () => {
  describe('when the configured model URL is Ollama local', () => {
    it('uses a local custom provider entry as the builder default', () => {
      process.env.MASTRA_DESKTOP_MODEL_URL = 'http://localhost:11434/v1';
      process.env.MASTRA_DESKTOP_MODEL_ID = 'llama3.2';

      expect(getDesktopBuilderConfig()).toMatchObject({
        enabled: true,
        features: { agent: { browser: false, model: true } },
        configuration: {
          agent: {
            models: {
              allowed: [{ kind: 'custom', provider: 'ollama' }],
              default: { kind: 'custom', provider: 'ollama', modelId: 'llama3.2' },
            },
          },
        },
      });
    });
  });

  describe('when the configured model URL is LM Studio local', () => {
    it('uses a local LM Studio custom provider entry as the builder default', () => {
      process.env.MASTRA_DESKTOP_MODEL_URL = 'http://localhost:1234/v1';
      process.env.MASTRA_DESKTOP_MODEL_ID = 'loaded-model';

      expect(getDesktopBuilderConfig()).toMatchObject({
        configuration: {
          agent: {
            models: {
              allowed: [{ kind: 'custom', provider: 'lmstudio' }],
              default: { kind: 'custom', provider: 'lmstudio', modelId: 'loaded-model' },
            },
          },
        },
      });
    });
  });
});

describe('bundled desktop runtime agents', () => {
  describe('when the starter runtime is loaded', () => {
    it('registers the desktop assistant and builder agent', () => {
      const agentIds = Object.values(mastra.listAgents()).map(agent => agent.id);

      expect(agentIds).toEqual(expect.arrayContaining(['desktop-assistant', 'builder-agent']));
    });
  });
});
