import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScenarioContext, ScenarioStep } from '../../scripts/smoke-test/scenario.js';
import { exaScenario } from '../../scripts/smoke-test/scenarios/exa.js';

// Drives the Exa smoke scenario with a stand-in `call`, so each check records
// what the scenario sends and how it scores what comes back.

const TOOL_IDS = ['exa_search', 'exa_get_contents', 'exa_answer'];

const RESPONSES: Record<string, unknown> = {
  exa_search: { results: [{ id: 'https://example.com/a', url: 'https://example.com/a', title: null }] },
  exa_get_contents: {
    results: [{ id: 'https://example.com/a', text: 'Example page' }],
    statuses: [{ id: 'https://example.com/a', status: 'success' }],
  },
  exa_answer: { answer: 'TypeScript.', citations: [{ id: 'https://mastra.ai' }] },
};

async function runScenario({
  fail = {},
  responses = {},
  toolIds = TOOL_IDS,
}: { fail?: Record<string, string>; responses?: Record<string, unknown>; toolIds?: string[] } = {}) {
  const calls: Array<{ toolId: string; input: Record<string, unknown> }> = [];
  const tools = Object.fromEntries(toolIds.map(id => [id, {}]));
  const context = {
    integrationId: 'exa',
    tools,
    allTools: tools,
    runId: 'run-1',
    log: { info() {}, warn() {}, error() {} },
    call: async <T>(toolId: string, input: Record<string, unknown>): Promise<T> => {
      calls.push({ toolId, input });
      if (fail[toolId]) throw new Error(fail[toolId]);
      return (responses[toolId] ?? RESPONSES[toolId]) as T;
    },
  } as unknown as ScenarioContext;
  const steps: ScenarioStep[] = await exaScenario.run(context);
  return { steps, calls };
}

describe('Exa smoke scenario without billed calls', () => {
  beforeEach(() => vi.stubEnv('MASTRA_SMOKE_EXA_ALLOW_BILLED', ''));
  afterEach(() => vi.unstubAllEnvs());

  it('makes no billed call: probes contents with an id Exa refuses and skips search and answer', async () => {
    const { steps, calls } = await runScenario({
      fail: { exa_get_contents: 'exa_get_contents failed: status=400 INVALID_URLS' },
    });

    expect(steps.map(step => [step.toolId, step.status])).toEqual([
      ['exa_search', 'skip'],
      ['exa_get_contents', 'pass'],
      ['exa_answer', 'skip'],
    ]);
    expect(calls).toEqual([{ toolId: 'exa_get_contents', input: { ids: ['mastra-smoke-not-a-url'], text: {} } }]);
  });

  it('fails a probe that Exa refuses for a reason other than the blank input', async () => {
    const { steps } = await runScenario({
      fail: { exa_get_contents: 'exa_get_contents failed: status=401 INVALID_API_KEY' },
    });

    expect(steps).toContainEqual(expect.objectContaining({ toolId: 'exa_get_contents', status: 'fail' }));
  });
});

describe('Exa smoke scenario with billed calls allowed', () => {
  beforeEach(() => vi.stubEnv('MASTRA_SMOKE_EXA_ALLOW_BILLED', '1'));
  afterEach(() => vi.unstubAllEnvs());

  it('passes every tool and reads the contents of the first search result', async () => {
    const { steps, calls } = await runScenario();

    expect(steps.map(step => [step.toolId, step.status])).toEqual([
      ['exa_search', 'pass'],
      ['exa_get_contents', 'pass'],
      ['exa_answer', 'pass'],
    ]);
    expect(calls.find(call => call.toolId === 'exa_get_contents')?.input).toMatchObject({
      ids: ['https://example.com/a'],
    });
  });

  it('skips when a tool is missing from the toolset', async () => {
    const { steps, calls } = await runScenario({ toolIds: ['exa_search', 'exa_answer'] });

    expect(steps).toEqual([expect.objectContaining({ name: 'preflight', status: 'skip' })]);
    expect(calls).toEqual([]);
  });

  it('reads a known page and keeps going when search fails', async () => {
    const { steps, calls } = await runScenario({ fail: { exa_search: 'exa_search failed: status=500' } });

    expect(steps.map(step => step.status)).toEqual(['fail', 'pass', 'pass']);
    expect(calls.find(call => call.toolId === 'exa_get_contents')?.input).toMatchObject({ ids: ['https://mastra.ai'] });
  });

  it('fails the contents read when Exa returns no text for the page', async () => {
    const { steps } = await runScenario({
      responses: {
        exa_get_contents: {
          results: [],
          statuses: [{ id: 'https://example.com/a', status: 'error', error: { tag: 'CRAWL_NOT_FOUND' } }],
        },
      },
    });

    expect(steps).toContainEqual(
      expect.objectContaining({
        toolId: 'exa_get_contents',
        status: 'fail',
        detail: expect.stringMatching(/CRAWL_NOT_FOUND/),
      }),
    );
  });

  it('fails the answer step on an empty answer', async () => {
    const { steps } = await runScenario({ responses: { exa_answer: { answer: '', citations: [] } } });

    expect(steps).toContainEqual(expect.objectContaining({ toolId: 'exa_answer', status: 'fail' }));
  });
});
