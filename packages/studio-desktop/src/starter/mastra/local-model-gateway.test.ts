import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { desktopAgents } from './agents/template-agents';
import {
  getDesktopBuilderAgentModelConfig,
  getDesktopBuilderConfig,
  getDesktopConfiguredExternalModelAllowlistEntries,
} from './desktop-builder';
import { DesktopLocalModelGateway, getDesktopModelConfig } from './local-model-gateway';
import { desktopRuntimeBundlerConfig, mastra } from './index';

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

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
              allowed: [
                { kind: 'custom', provider: 'ollama' },
                { kind: 'custom', provider: 'desktop-local/ollama' },
              ],
              default: { kind: 'custom', provider: 'desktop-local/ollama', modelId: 'llama3.2' },
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
              allowed: [
                { kind: 'custom', provider: 'lmstudio' },
                { kind: 'custom', provider: 'desktop-local/lmstudio' },
              ],
              default: { kind: 'custom', provider: 'desktop-local/lmstudio', modelId: 'loaded-model' },
            },
          },
        },
      });
    });
  });

  describe('when external provider keys are configured', () => {
    it('allows Anthropic alongside the local desktop provider', () => {
      process.env.MASTRA_DESKTOP_MODEL_URL = 'http://localhost:11434/v1';
      process.env.MASTRA_DESKTOP_MODEL_ID = 'llama3.2';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-local';

      expect(getDesktopConfiguredExternalModelAllowlistEntries()).toEqual([{ provider: 'anthropic' }]);
      expect(getDesktopBuilderConfig()).toMatchObject({
        configuration: {
          agent: {
            models: {
              allowed: [
                { kind: 'custom', provider: 'ollama' },
                { kind: 'custom', provider: 'desktop-local/ollama' },
                { provider: 'anthropic' },
              ],
            },
          },
        },
      });
    });
  });
});

describe('getDesktopBuilderAgentModelConfig', () => {
  describe('when Anthropic is configured for the desktop runtime', () => {
    it('uses Anthropic for the internal builder agent instead of the local model', () => {
      process.env.MASTRA_DESKTOP_MODEL_URL = 'http://localhost:11434/v1';
      process.env.MASTRA_DESKTOP_MODEL_ID = 'llama3.2';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-local';

      expect(getDesktopBuilderAgentModelConfig()).toBe('anthropic/claude-sonnet-4-6');
    });
  });

  describe('when only OpenAI is configured for the desktop runtime', () => {
    it('uses OpenAI for the internal builder agent', () => {
      process.env.MASTRA_DESKTOP_MODEL_URL = 'http://localhost:11434/v1';
      process.env.MASTRA_DESKTOP_MODEL_ID = 'llama3.2';
      process.env.OPENAI_API_KEY = 'sk-openai-local';

      expect(getDesktopBuilderAgentModelConfig()).toBe('openai/gpt-5.5');
    });
  });

  describe('when no cloud provider key is configured', () => {
    it('falls back to the configured local desktop model', () => {
      process.env.MASTRA_DESKTOP_MODEL_URL = 'http://localhost:11434/v1';
      process.env.MASTRA_DESKTOP_MODEL_ID = 'llama3.2';
      process.env.MASTRA_DESKTOP_MODEL_API_KEY = 'ollama';

      expect(getDesktopBuilderAgentModelConfig()).toEqual({
        apiKey: 'ollama',
        modelId: 'llama3.2',
        providerId: 'ollama',
        url: 'http://localhost:11434/v1',
      });
    });
  });
});

describe('bundled desktop runtime agents', () => {
  describe('when the starter runtime is loaded', () => {
    it('externalizes native runtime dependencies for packaged desktop builds', () => {
      expect(desktopRuntimeBundlerConfig).toEqual({ externals: true });
    });

    it('registers the desktop template agents and builder agent', () => {
      const agentIds = Object.values(mastra.listAgents()).map(agent => agent.id);

      expect(agentIds).toEqual(
        expect.arrayContaining([
          'builder-agent',
          'desktop-assistant',
          'local-model-guide',
          'workflow-planner',
          'tool-designer',
          'desktop-orchestrator',
        ]),
      );
    });

    it('enables memory for every bundled template agent', async () => {
      for (const agent of Object.values(desktopAgents)) {
        expect(agent.hasOwnMemory()).toBe(true);
        await expect(agent.getMemory()).resolves.toMatchObject({
          id: `${agent.id}-memory`,
        });
      }
    });

    it('registers desktop specialists as subagents on the orchestrator', async () => {
      await expect(Promise.resolve(desktopAgents.desktopOrchestrator.listAgents())).resolves.toEqual({
        localModelGuide: desktopAgents.localModelGuide,
        workflowPlanner: desktopAgents.workflowPlanner,
        toolDesigner: desktopAgents.toolDesigner,
      });
    });

    it('wires persistent runtime memory alongside filesystem editor storage', async () => {
      const storage = mastra.getStorage();
      expect(storage).toBeDefined();
      if (!storage) throw new Error('Expected desktop runtime storage to be configured');

      await storage.init();
      await expect(storage.getStore('memory')).resolves.toBeDefined();
      await expect(storage.getStore('agents')).resolves.toBeDefined();

      const memory = await desktopAgents.desktopOrchestrator.getMemory();
      expect(memory).toBeDefined();
      if (!memory) throw new Error('Expected desktop orchestrator memory to be configured');

      await expect(
        memory.createThread({
          threadId: 'desktop-runtime-memory-test',
          resourceId: 'desktop-user',
        }),
      ).resolves.toMatchObject({
        id: 'desktop-runtime-memory-test',
        resourceId: 'desktop-user',
      });
    });
  });
});
