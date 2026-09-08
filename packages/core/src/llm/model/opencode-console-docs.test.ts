import { stripTypeScriptTypes } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateIndexPage, generateProviderPage, parseProviders } from '../../../scripts/generate-model-docs';
import { Agent } from '../../agent';
import { RequestContext } from '../../request-context';
import { createMockModel } from '../../test-utils/llm-mock';
import { buildOpenCodeConsoleProvider } from './gateways/opencode-console';

const modelIds = ['glm-5.3-flash', 'qwen3.6-plus', 'muse-spark-1.3', 'gemini-3.8-flash', 'unknown-model'];
const { config } = buildOpenCodeConsoleProvider({ modelIds });

function page() {
  return generateProviderPage(
    {
      id: 'opencode-console',
      name: config.name,
      models: config.models,
      url: config.url,
      apiKeyEnvVar: config.apiKeyEnvVar,
      apiKeyHeader: 'Authorization',
      isGateway: false,
      isPopular: false,
    },
    { 'opencode-console': config },
  );
}

function mockCatalog(consoleRecord = false) {
  const models = Object.fromEntries(
    modelIds.slice(0, -1).map(id => [
      id,
      {
        modalities: { input: ['text', 'image', 'audio', 'video'] },
        tool_call: true,
        reasoning: true,
        limit: { context: 200000, output: 8192 },
        cost: { input: 0, output: 1 },
      },
    ]),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        opencode: { models },
        ...(consoleRecord ? { 'opencode-console': { models } } : {}),
      }),
    ),
  );
}

async function runExample(source: string, result: string) {
  const code = stripTypeScriptTypes(source.replace(/^import .*;\n/gm, ''));
  const execute = new Function(
    'Agent',
    'RequestContext',
    'createMockModel',
    `return (async () => {${code}\n${result}})()`,
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('External requests disabled');
    }),
  );
  return execute(Agent, RequestContext, createMockModel);
}

function examples(content: string): string[] {
  return [...content.matchAll(/```typescript[^\n]*\n([\s\S]*?)```/g)].map(match => match[1]!);
}

describe('OpenCode Console generated documentation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('limits media claims to default routes and omits inherited commercial claims', async () => {
    mockCatalog();
    const content = await page();
    const serialized = content.match(/models=\{(\[[\s\S]*?\])\}/)?.[1];
    expect(serialized).toBeDefined();
    const models = JSON.parse(serialized!);
    for (const id of ['glm-5.3-flash', 'qwen3.6-plus', 'muse-spark-1.3']) {
      expect(models.find((model: { model: string }) => model.model === `opencode-console/${id}`)).toMatchObject({
        audioInput: false,
        videoInput: false,
        imageInput: true,
        inputCost: null,
        outputCost: null,
      });
    }
    expect(models.find((model: { model: string }) => model.model.endsWith('/gemini-3.8-flash'))).toMatchObject({
      audioInput: true,
      videoInput: true,
    });
    expect(models.find((model: { model: string }) => model.model.endsWith('/unknown-model'))).toMatchObject({
      imageInput: null,
      audioInput: null,
      videoInput: null,
      toolUsage: null,
      reasoning: null,
    });
    expect(content).toContain('MissingSessionID');
    expect(content).toContain('service-account');
    expect(content).toContain('Paid inference requires available Console credit');
    expect(content).toContain('inherited prices are omitted');
    expect(content).toContain('has not been verified');
    expect(content).toContain('catalogOnly');
    expect(examples(content)[1]).not.toContain('url:');
    expect(examples(content)[1]).toContain('"x-session-id"');
    expect(content).toContain('x-opencode-org-id');
  });

  it('prefers Console-owned metadata when available, preserving zero prices', async () => {
    mockCatalog(true);
    const content = await page();
    expect(content).toContain('"inputCost": 0');
    expect(content).toContain('"outputCost": 1');
  });

  it('reports unknown capabilities when metadata is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({})),
    );
    const content = await page();
    expect(content).toContain('"toolUsage": null');
    expect(content).not.toContain('"toolUsage": true');
    expect(content).not.toContain('"imageInput": false');
  });

  it('runs the generated streaming example against an actual Agent and local mock model', async () => {
    mockCatalog();
    const source = examples(await page())[0]!.replace(
      '"opencode-console/glm-5.3-flash"',
      'createMockModel({ mockText: "local response" })',
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runExample(source, '');
    expect(log.mock.calls.flat().join('')).toContain('local response');
  });

  it('runs both generated dynamic-selection branches with a populated RequestContext', async () => {
    mockCatalog();
    const source = examples(await page())[2]!
      .replace('"opencode-console/qwen3.6-plus"', 'createMockModel({ mockText: "advanced" })')
      .replace('"opencode-console/glm-5.3-flash"', 'createMockModel({ mockText: "simple" })');
    expect(await runExample(source, 'return response.text;')).toBe('advanced');
    expect(
      await runExample(source.replace('set("task", "complex")', 'set("task", "simple")'), 'return response.text;'),
    ).toBe('simple');
  });

  it('derives aggregate model and provider counts from the changed registry', async () => {
    const grouped = await parseProviders();
    const content = generateIndexPage(grouped);
    expect(content).toContain('201');
    expect(content).toContain('7166');
  });
});
