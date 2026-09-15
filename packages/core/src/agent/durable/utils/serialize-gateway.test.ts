import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { MastraModelGatewayInterface } from '../../../llm/model/gateways/base';
import { ModelRouterLanguageModel } from '../../../llm/model/router';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { serializeModelConfig, serializeModelList } from './serialize-state';

// Construction and snapshot restoration must never contact the provider.
const gateways = [{ id: 'openrouter' }] as MastraModelGatewayInterface[];
const routes = ['openrouter/qwen/qwen3.8-max-0902', 'openrouter/anthropic/claude-opus-5'] as const;

describe('durable model gateway identity', () => {
  it.each(routes)('preserves %s in the real durable preparation output', async id => {
    const pubsub = new EventEmitterPubSub();
    try {
      const agent = new Agent({
        id: 'gateway-preparation',
        name: 'Gateway preparation',
        instructions: 'Test',
        model: [{ id: 'selected-route', model: new ModelRouterLanguageModel(id, gateways), maxRetries: 0 }],
      });
      const durable = createDurableAgent({ agent, pubsub });
      const prepared = await durable.prepare('Retain the selected gateway');
      const saved = JSON.parse(JSON.stringify(prepared.workflowInput));
      expect(saved.modelConfig.originalConfig).toBe(id);
      expect(saved.modelList[0].config.originalConfig).toBe(id);
      const restored = new ModelRouterLanguageModel(saved.modelList[0].config.originalConfig, gateways);
      expect(restored.gatewayId).toBe('openrouter');
    } finally {
      await pubsub.close();
    }
  });

  it.each(routes)('retains %s through a JSON snapshot', id => {
    const model = new ModelRouterLanguageModel(id, gateways);
    const saved = JSON.parse(JSON.stringify(serializeModelConfig(model)));
    const restored = new ModelRouterLanguageModel(saved.originalConfig, gateways);
    expect(saved.originalConfig).toBe(id);
    expect(restored.gatewayId).toBe(model.gatewayId);
    expect(restored.provider).toBe(model.provider);
    expect(restored.modelId).toBe(model.modelId);
  });

  it('retains routing and retry options for every enabled model-list entry', () => {
    const entries = routes.map((id, index) => ({
      id: `route-${index}`,
      model: new ModelRouterLanguageModel(id, gateways),
      enabled: true,
      maxRetries: index,
      providerOptions: { openrouter: { user: 'test-user' } },
    }));
    const saved = JSON.parse(JSON.stringify(serializeModelList(entries)));
    for (const [index, entry] of saved.entries()) {
      const restored = new ModelRouterLanguageModel(entry.config.originalConfig, gateways);
      expect(restored.gatewayId).toBe('openrouter');
      expect(entry.config.originalConfig).toBe(routes[index]);
      expect(entry.id).toBe(entries[index].id);
      expect(entry.maxRetries).toBe(index);
      expect(entry.config.providerOptions).toEqual(entries[index].providerOptions);
    }
  });

  it('stores no credential-bearing router configuration', () => {
    const model = new ModelRouterLanguageModel(
      {
        id: routes[0],
        apiKey: 'private-api-key',
        headers: { Authorization: 'private-header' },
        url: 'https://private-endpoint.invalid',
      },
      gateways,
    );
    const saved = serializeModelConfig(model);
    expect(saved.originalConfig).toBe(routes[0]);
    expect(Object.keys(saved).sort()).toEqual(['modelId', 'originalConfig', 'provider', 'specificationVersion']);
    expect(JSON.stringify(saved)).not.toContain('private-');
  });

  it('keeps unprefixed registry routes unchanged', () => {
    const model = new ModelRouterLanguageModel('openai/gpt-4o');
    const saved = serializeModelConfig(model);
    expect(saved.originalConfig).toBe('openai/gpt-4o');
    expect(new ModelRouterLanguageModel(saved.originalConfig as 'openai/gpt-4o').gatewayId).toBe('models.dev');
  });
});
