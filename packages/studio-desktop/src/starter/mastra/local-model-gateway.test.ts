import { afterEach, describe, expect, it } from 'vitest';
import { DesktopLocalModelGateway, getDesktopModelConfig } from './local-model-gateway';

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
  });
});
