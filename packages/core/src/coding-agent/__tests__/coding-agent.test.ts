import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent/agent';
import { LocalFilesystem, LocalSandbox, Workspace } from '../../workspace';
import type { PromptContext } from '../index';
import { buildBasePrompt, createCodingAgent } from '../index';

const MODEL = 'openai/gpt-4o-mini';

function baseConfig(overrides: Partial<Parameters<typeof createCodingAgent>[0]> = {}) {
  return {
    id: 'test-coding-agent',
    name: 'Test Coding Agent',
    model: MODEL,
    instructions: 'You are a helpful coding assistant.',
    tools: {},
    ...overrides,
  };
}

function promptContext(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    projectPath: '/repo',
    projectName: 'repo',
    platform: 'darwin',
    date: '2026-06-30',
    mode: 'build',
    toolGuidance: '',
    ...overrides,
  };
}

describe('createCodingAgent', () => {
  it('returns an Agent', () => {
    const agent = createCodingAgent(baseConfig());
    expect(agent).toBeInstanceOf(Agent);
    expect(agent.id).toBe('test-coding-agent');
  });

  it('builds a default local workspace when none is provided', async () => {
    const agent = createCodingAgent(baseConfig());
    const workspace = await agent.getWorkspace();

    expect(workspace).toBeInstanceOf(Workspace);
    expect(workspace?.filesystem).toBeInstanceOf(LocalFilesystem);
    expect(workspace?.sandbox).toBeInstanceOf(LocalSandbox);
  });

  it('roots the default workspace at workspaceBasePath', async () => {
    const agent = createCodingAgent(baseConfig({ workspaceBasePath: '/custom/base' }));
    const workspace = await agent.getWorkspace();

    expect((workspace?.sandbox as LocalSandbox).workingDirectory).toBe('/custom/base');
  });

  it('builds no default workspace when workspace is explicitly undefined', async () => {
    const agent = createCodingAgent(baseConfig({ workspace: undefined }));
    const workspace = await agent.getWorkspace();

    expect(workspace).toBeUndefined();
  });

  it('uses a caller-provided workspace verbatim', async () => {
    const custom = new Workspace({
      filesystem: new LocalFilesystem({ basePath: '/somewhere' }),
      sandbox: new LocalSandbox({ workingDirectory: '/somewhere' }),
    });

    const agent = createCodingAgent(baseConfig({ workspace: custom }));
    const workspace = await agent.getWorkspace();

    expect(workspace).toBe(custom);
  });

  it('does not throw when goal is configured (prompt defaulted)', () => {
    const agent = createCodingAgent(
      baseConfig({
        goal: { judge: MODEL, maxRuns: 5 },
      }),
    );
    expect(agent).toBeInstanceOf(Agent);
  });

  it('accepts caller-provided signals and error processors', () => {
    const agent = createCodingAgent(
      baseConfig({
        signals: [],
        errorProcessors: [],
      }),
    );
    expect(agent).toBeInstanceOf(Agent);
  });
});

describe('buildBasePrompt', () => {
  it('defaults the product name to "Mastra Code"', () => {
    const prompt = buildBasePrompt(promptContext());
    expect(prompt).toContain('You are Mastra Code, an interactive CLI coding agent');
    expect(prompt).toContain('Co-Authored-By: Mastra Code <noreply@mastra.ai>');
  });

  it('parameterizes productName and coAuthorName', () => {
    const prompt = buildBasePrompt(promptContext({ productName: 'Acme Coder', coAuthorName: 'Acme Bot' }));
    expect(prompt).toContain('You are Acme Coder, an interactive CLI coding agent');
    expect(prompt).toContain('Acme Coder has a goal mode');
    expect(prompt).toContain('Co-Authored-By: Acme Bot <noreply@mastra.ai>');
  });

  it('includes the model id in the Co-Authored-By line when provided', () => {
    const prompt = buildBasePrompt(promptContext({ modelId: 'openai/gpt-4o' }));
    expect(prompt).toContain('Co-Authored-By: Mastra Code (openai/gpt-4o) <noreply@mastra.ai>');
  });

  it('parameterizes the Co-Authored-By email', () => {
    const prompt = buildBasePrompt(promptContext({ coAuthorName: 'Acme Bot', coAuthorEmail: 'bot@acme.dev' }));
    expect(prompt).toContain('Co-Authored-By: Acme Bot <bot@acme.dev>');
  });
});
