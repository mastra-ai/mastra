import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import { it, expect } from 'vitest';
import { z } from 'zod';
import type { Processor } from '../../../../processors';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: input processors run before the model request.
 *
 * An input processor mutates the user message (here, redacting a secret token)
 * before the loop serializes the first request. We assert the redaction lands in
 * `requests[0]` — i.e. the model never sees the raw secret. A regression where
 * input processors are skipped or run after request assembly is caught here.
 */
describeForAllEngines('AIMock loop scenario: input processor', engine => {
  const getMock = useLoopScenarioAimock();

  it('redacts the user message before it reaches the model request', async () => {
    const redactInput: Processor = {
      id: 'redact-input-secret',
      processInput({ messages }) {
        return messages.map(message => {
          if (message.role !== 'user') return message;
          return {
            ...message,
            content: {
              ...message.content,
              parts: message.content.parts?.map(part => {
                if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
                  return { ...part, text: part.text.replace(/INPUT_SECRET/g, '[REDACTED]') };
                }
                return part;
              }),
            },
          };
        });
      },
    };

    const { requests, output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My password is INPUT_SECRET, please acknowledge.',
      inputProcessors: [redactInput],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Acknowledged.' });
      },
    });

    expect(requests).toHaveLength(1);
    const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);
    expect(serialized).toContain('[REDACTED]');
    expect(serialized).not.toContain('INPUT_SECRET');

    const text = await output.text;
    expect(text).toContain('Acknowledged.');
  });

  // #25435: strict chat templates (e.g. Qwen3.x on vLLM) reject any system message that isn't
  // the single first message, so OpenAI-compatible chat requests must carry exactly one.
  it('sends one leading system message to OpenAI-compatible chat models', async () => {
    const llm = getMock();
    const addSystemMessage: Processor = {
      id: 'add-system-message',
      processInput({ messages, systemMessages }) {
        return {
          messages,
          systemMessages: [...systemMessages, { role: 'system', content: 'PROCESSOR_RULE: answer briefly.' }],
        };
      },
    };
    const lookup = createTool({
      id: 'lookup',
      description: 'Look up a value',
      inputSchema: z.object({ key: z.string() }),
      execute: async () => ({ value: 42 }),
    });
    const chatModel = createOpenAICompatible({
      name: 'vllm',
      apiKey: 'test',
      baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
    }).chatModel(SCENARIO_MODEL_ID);

    const { requests, output } = await runLoopScenario({
      engine,
      llm,
      model: chatModel,
      prompt: 'What is the value for x?',
      instructions: 'AGENT_RULE: you are a lookup assistant.',
      inputProcessors: [addSystemMessage],
      tools: { lookup },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ name: 'lookup', arguments: '{"key":"x"}' }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The value is 42.' });
      },
    });

    expect(await output.text).toContain('The value is 42.');
    expect(requests.length).toBeGreaterThanOrEqual(2);
    for (const request of requests) {
      const messages = (request.body?.messages ?? []) as Array<{ role: string; content: unknown }>;
      expect(messages.filter(m => m.role === 'system')).toHaveLength(1);
      expect(messages[0]?.role).toBe('system');
      const system = JSON.stringify(messages[0]?.content);
      expect(system).toContain('AGENT_RULE');
      expect(system).toContain('PROCESSOR_RULE');
    }
  });

  it('keeps separate system messages when an earlier one has its own providerOptions', async () => {
    const llm = getMock();
    const cacheBreakpoint = { openaiCompatible: { cacheControl: { type: 'ephemeral' } } };
    const chatModel = createOpenAICompatible({
      name: 'vllm',
      apiKey: 'test',
      baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
    }).chatModel(SCENARIO_MODEL_ID);

    const { requests } = await runLoopScenario({
      engine,
      llm,
      model: chatModel,
      prompt: 'hi',
      instructions: [
        { role: 'system', content: 'AGENT_RULE: be helpful.', providerOptions: cacheBreakpoint },
        { role: 'system', content: 'SECOND_RULE: be brief.' },
      ],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'ok' });
      },
    });

    expect(requests).toHaveLength(1);
    const messages = (requests[0]!.body?.messages ?? []) as Array<{ role: string }>;
    expect(messages.filter(m => m.role === 'system')).toHaveLength(2);
  });

  it('leaves Anthropic system blocks separate', async () => {
    const llm = getMock();
    // aimock normalizes Anthropic requests to chat format, so capture the raw wire body.
    const sentBodies: Array<{ system?: Array<{ text: string }> }> = [];
    const anthropicModel = createAnthropic({
      apiKey: 'test',
      baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
      fetch: async (url, init) => {
        sentBodies.push(JSON.parse(init!.body as string));
        return fetch(url, init);
      },
    })(SCENARIO_MODEL_ID);

    await runLoopScenario({
      engine,
      llm,
      model: anthropicModel,
      prompt: 'hi',
      instructions: ['AGENT_RULE: be helpful.', 'SECOND_RULE: be brief.'],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'ok' });
      },
    });

    expect(sentBodies).toHaveLength(1);
    expect(sentBodies[0]!.system?.map(block => block.text)).toEqual([
      'AGENT_RULE: be helpful.',
      'SECOND_RULE: be brief.',
    ]);
  });
});
