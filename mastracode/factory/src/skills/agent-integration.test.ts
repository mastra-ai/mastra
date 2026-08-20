import { createCodingAgent } from '@mastra/core/coding-agent';
import { createSkill } from '@mastra/core/skills';
import type { SkillSource } from '@mastra/core/workspace';
import { Workspace } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

import { createFactorySkillCatalog } from './catalog.js';

function systemText(prompt: unknown): string {
  if (!Array.isArray(prompt)) return '';
  return prompt
    .filter(message => message?.role === 'system')
    .map(message => (typeof message.content === 'string' ? message.content : JSON.stringify(message.content)))
    .join('\n');
}

function makeCaptureModel(captured: { prompt?: unknown; tools?: unknown }) {
  return {
    specificationVersion: 'v2',
    provider: 'factory-test',
    modelId: 'factory-test-model',
    supportedUrls: {},
    doGenerate: async ({ prompt, tools }: { prompt: unknown; tools: unknown }) => {
      captured.prompt = prompt;
      captured.tools = tools;
      return {
        content: [{ type: 'text', text: 'ok' }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        rawCall: { rawPrompt: prompt, rawSettings: {} },
        warnings: [],
      };
    },
  } as never;
}

const bundledTestSkill = createSkill({
  name: 'factory-test',
  description: 'Factory integration skill',
  instructions: 'Use the Factory integration instructions.',
});

describe('Factory skill agent integration', () => {
  it('registers bundled inline skills on the real coding agent without a workspace', async () => {
    const captured: { prompt?: unknown; tools?: unknown } = {};
    const catalog = createFactorySkillCatalog([bundledTestSkill]);
    const agent = createCodingAgent({
      id: 'factory-agent-integration',
      name: 'Factory Agent Integration',
      instructions: 'You are a Factory coding agent.',
      model: makeCaptureModel(captured),
      tools: {},
      workspace: undefined,
      skills: catalog.skills,
    });

    await agent.generate('Start');

    expect(
      Array.isArray(captured.tools) ? captured.tools.map(tool => tool.name) : Object.keys(captured.tools ?? {}),
    ).toContain('skill');
    expect(systemText(captured.prompt)).toContain('factory-test');
    expect(systemText(captured.prompt)).toContain('available_skills');
  });

  it('keeps repository skills out of the prompt before materialization and never reads the repository source', async () => {
    const captured: { prompt?: unknown; tools?: unknown } = {};
    const sourceCalls: string[] = [];
    const track = (method: string) => {
      sourceCalls.push(method);
      throw new Error(`repository skill source must not be touched before materialization (${method})`);
    };
    const repositorySource: SkillSource = {
      exists: async () => track('exists'),
      stat: async () => track('stat'),
      readFile: async () => track('readFile'),
      readdir: async () => track('readdir'),
    };
    // Mirrors the Factory session workspace pre-materialization state: the
    // dynamic resolver reports no repository roots yet, so discovery resolves
    // immediately without touching the repository source.
    const workspace = new Workspace({
      id: 'factory-agent-integration-pre-materialization',
      name: 'Factory pre-materialization workspace',
      skills: () => [],
      skillSource: repositorySource,
    });
    const catalog = createFactorySkillCatalog([bundledTestSkill]);
    const agent = createCodingAgent({
      id: 'factory-agent-integration-workspace',
      name: 'Factory Agent Integration Workspace',
      instructions: 'You are a Factory coding agent.',
      model: makeCaptureModel(captured),
      tools: {},
      workspace,
      skills: catalog.skills,
    });

    await agent.generate('Start');

    const system = systemText(captured.prompt);
    expect(system).toContain('factory-test');
    expect(system).not.toContain('repo-shadow-skill');
    expect(sourceCalls).toEqual([]);
  });
});
