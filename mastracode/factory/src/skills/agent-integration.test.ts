import { createCodingAgent } from '@mastra/core/coding-agent';
import { describe, expect, it } from 'vitest';

import { createFactorySkillCatalog } from './catalog.js';

function systemText(prompt: unknown): string {
  if (!Array.isArray(prompt)) return '';
  return prompt
    .filter(message => message?.role === 'system')
    .map(message => (typeof message.content === 'string' ? message.content : JSON.stringify(message.content)))
    .join('\n');
}

describe('Factory skill agent integration', () => {
  it('registers bundled inline skills on the real coding agent without a workspace', async () => {
    let capturedPrompt: unknown;
    let capturedTools: unknown;
    const model = {
      specificationVersion: 'v2',
      provider: 'factory-test',
      modelId: 'factory-test-model',
      supportedUrls: {},
      doGenerate: async ({ prompt, tools }: { prompt: unknown; tools: unknown }) => {
        capturedPrompt = prompt;
        capturedTools = tools;
        return {
          content: [{ type: 'text', text: 'ok' }],
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          rawCall: { rawPrompt: prompt, rawSettings: {} },
          warnings: [],
        };
      },
    } as never;
    const catalog = createFactorySkillCatalog([
      {
        __inline: true,
        __referenceContents: {},
        name: 'factory-test',
        description: 'Factory integration skill',
        instructions: 'Use the Factory integration instructions.',
        path: 'inline/factory-test',
        source: { type: 'local', projectPath: 'inline/factory-test' },
        references: [],
        scripts: [],
        assets: [],
      },
    ]);
    const agent = createCodingAgent({
      id: 'factory-agent-integration',
      name: 'Factory Agent Integration',
      instructions: 'You are a Factory coding agent.',
      model,
      tools: {},
      workspace: undefined,
      skills: catalog.skills,
    });

    await agent.generate('Start');

    expect(
      Array.isArray(capturedTools) ? capturedTools.map(tool => tool.name) : Object.keys(capturedTools ?? {}),
    ).toContain('skill');
    expect(systemText(capturedPrompt)).toContain('factory-test');
    expect(systemText(capturedPrompt)).toContain('available_skills');
  });
});
