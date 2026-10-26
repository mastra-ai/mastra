import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * `prepareStep` can introduce tools the agent never registered and swap the
 * model for a step using either a Mastra model config object or a model router
 * string. The step must actually run with what `prepareStep` returned.
 *
 * Replaces the hash-matched `agent.e2e` prepareStep recordings for new tools
 * with forced `toolChoice`, the OpenAI-compatible config object, and the model
 * router magic string.
 */

function toolResultCount(req: { messages?: Array<{ role?: string }> }): number {
  return (req.messages ?? []).filter(m => m.role === 'tool').length;
}

function offeredTools(request: any): string[] {
  return (request?.body?.tools ?? []).map((t: any) => t.name ?? t.function?.name).sort();
}

describeForAllEngines('AIMock loop scenario: prepareStep dynamic tools and models', engine => {
  const getMock = useLoopScenarioAimock();

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('executes tools added only by prepareStep with a forced toolChoice per step', async () => {
    const calls: string[] = [];
    const makeTool = (id: string) =>
      createTool({
        id,
        description: id,
        inputSchema: z.object({ value: z.string() }),
        execute: async () => {
          calls.push(id);
          return `${id}-result`;
        },
      });
    const tool1 = makeTool('tool1');
    const tool2 = makeTool('tool2');
    const tool3 = makeTool('tool3');

    const script = ['tool1', 'tool2', 'tool3', 'tool1'];
    const seen: Array<{ stepNumber: number; tools: string[] }> = [];

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      tools: { tool1 },
      maxSteps: 5,
      prepareStep: ({ stepNumber, tools }: any) => {
        seen.push({ stepNumber, tools: Object.keys(tools ?? {}) });
        const toolChoice =
          stepNumber < script.length ? { type: 'tool' as const, toolName: script[stepNumber]! } : 'none';
        if (stepNumber === 1) return { tools: { tool2 }, toolChoice };
        if (stepNumber === 2) return { tools: { tool3 }, toolChoice };
        return { toolChoice };
      },
      fixtures: llm => {
        script.forEach((name, i) => {
          llm.on(
            { endpoint: 'chat', predicate: req => toolResultCount(req as any) === i },
            { toolCalls: [{ id: `call_${i}`, name, arguments: { value: `v${i}` } }] },
          );
        });
        llm.on(
          { endpoint: 'chat', predicate: req => toolResultCount(req as any) === script.length },
          { content: 'done' },
        );
      },
    });

    expect(await output.text).toBe('done');
    expect(calls).toEqual(script);
    expect(requests).toHaveLength(5);

    expect(requests.map(r => (r.body as any)?.tool_choice)).toEqual([
      { type: 'function', name: 'tool1' },
      { type: 'function', name: 'tool2' },
      { type: 'function', name: 'tool3' },
      { type: 'function', name: 'tool1' },
      'none',
    ]);
    expect(offeredTools(requests[1])).toContain('tool2');
    expect(offeredTools(requests[2])).toContain('tool3');
    expect(offeredTools(requests[3])).toEqual(['tool1']);

    // prepareStep always receives the agent's own tool set, not the previous step's additions.
    expect(seen.map(s => s.stepNumber)).toEqual([0, 1, 2, 3, 4]);
    expect(seen.every(s => s.tools.join() === 'tool1')).toBe(true);
  });

  it('runs the step on an OpenAI-compatible model config object returned by prepareStep', async () => {
    const llm = getMock();
    const baseUrl = `${llm.url.replace(/\/+$/, '')}/v1`;
    let stepModel: { provider?: string; modelId?: string } | undefined;

    const { output, requests } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Hello',
      model: { id: 'openai/gpt-4o', url: baseUrl, apiKey: 'aimock-test-key' },
      prepareStep: ({ model, stepNumber }: any) => {
        if (stepNumber !== 0) return undefined;
        stepModel = { provider: model.provider, modelId: model.modelId };
        return { model: { providerId: 'openai', modelId: 'gpt-4.1-mini', url: baseUrl, apiKey: 'aimock-test-key' } };
      },
      fixtures: m => {
        m.on({ endpoint: 'chat' }, { content: 'switched' });
      },
    });

    expect(await output.text).toBe('switched');
    expect(stepModel).toEqual({ provider: 'openai', modelId: 'gpt-4o' });
    expect(requests).toHaveLength(1);
    expect((requests[0]!.body as any).model).toBe('gpt-4.1-mini');
  });

  it('runs the step on a model router string returned by prepareStep', async () => {
    const llm = getMock();
    vi.stubEnv('OPENAI_BASE_URL', `${llm.url.replace(/\/+$/, '')}/v1`);
    // The router caches provider instances by API key, not by OPENAI_BASE_URL, so a
    // per-engine key keeps each suite from reusing an instance bound to an earlier AIMock port.
    vi.stubEnv('OPENAI_API_KEY', `aimock-test-key-${engine}`);
    let stepModel: { provider?: string; modelId?: string } | undefined;

    const { output, requests } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Hello',
      model: 'openai/gpt-4o',
      prepareStep: ({ model, stepNumber }: any) => {
        if (stepNumber !== 0) return undefined;
        stepModel = { provider: model.provider, modelId: model.modelId };
        return { model: 'openai/gpt-4.1-mini' };
      },
      fixtures: m => {
        m.on({ endpoint: 'chat' }, { content: 'routed' });
      },
    });

    expect(await output.text).toBe('routed');
    expect(stepModel).toEqual({ provider: 'openai', modelId: 'gpt-4o' });
    expect(requests).toHaveLength(1);
    expect((requests[0]!.body as any).model).toBe('gpt-4.1-mini');
  });
});
