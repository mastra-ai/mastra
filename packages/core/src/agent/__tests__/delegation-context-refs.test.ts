import type { LanguageModelV2Prompt } from '@internal/ai-sdk-v5/provider';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { createDelegationRefRegistry, resolveDelegationRefs } from '../delegation-refs';

const EXPLORER_FINDING = 'Token refresh bug is in src/auth/refresh.ts:88 — the expiry check uses `<` instead of `<=`.';

function textStream(text: string) {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id', modelId: 'mock', timestamp: new Date(0) },
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: text },
    { type: 'text-end', id: 't' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ]);
}

function toolCallStream(toolName: string, input: Record<string, unknown>, toolCallId: string) {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id', modelId: 'mock', timestamp: new Date(0) },
    { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input) },
    { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ]);
}

function makeSubAgentModel(reply: string, prompts: LanguageModelV2Prompt[]) {
  return new MockLanguageModelV2({
    doGenerate: async options => {
      prompts.push(options.prompt);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text' as const, text: reply }],
        warnings: [],
      };
    },
    doStream: async options => {
      prompts.push(options.prompt);
      return { rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [], stream: textStream(reply) };
    },
  });
}

/** Supervisor that issues the given tool calls one per step, then replies "Done". */
function makeSupervisorModel(
  calls: Array<{ toolName: string; input: Record<string, unknown> }>,
  prompts: LanguageModelV2Prompt[],
) {
  let step = 0;
  return new MockLanguageModelV2({
    doGenerate: async options => {
      prompts.push(options.prompt);
      const call = calls[step];
      step++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: call ? ('tool-calls' as const) : ('stop' as const),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: call
          ? [
              {
                type: 'tool-call' as const,
                toolCallId: `call-${step}`,
                toolName: call.toolName,
                input: JSON.stringify(call.input),
              },
            ]
          : [{ type: 'text' as const, text: 'Done' }],
        warnings: [],
      };
    },
    doStream: async options => {
      prompts.push(options.prompt);
      const call = calls[step];
      step++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: call ? toolCallStream(call.toolName, call.input, `call-${step}`) : textStream('Done'),
      };
    },
  });
}

function userText(prompt: LanguageModelV2Prompt): string {
  return prompt
    .filter(m => m.role === 'user')
    .flatMap(m => (Array.isArray(m.content) ? m.content : []))
    .map(p => (p.type === 'text' ? p.text : ''))
    .join('\n');
}

function toolResultTexts(prompt: LanguageModelV2Prompt): string[] {
  return prompt
    .filter(m => m.role === 'tool')
    .flatMap(m => m.content)
    .map(p => {
      if (p.type !== 'tool-result') return '';
      const out = p.output as { type: string; value: unknown };
      return out.type === 'text' ? String(out.value) : JSON.stringify(out.value);
    });
}

function buildAgents(
  calls: Array<{ toolName: string; input: Record<string, unknown> }>,
  opts: { explorerReply?: string } = {},
) {
  const explorerPrompts: LanguageModelV2Prompt[] = [];
  const implementerPrompts: LanguageModelV2Prompt[] = [];
  const supervisorPrompts: LanguageModelV2Prompt[] = [];

  const explorer = new Agent({
    id: 'explorer',
    name: 'explorer',
    description: 'Explores the codebase',
    instructions: 'Explore.',
    model: makeSubAgentModel(opts.explorerReply ?? EXPLORER_FINDING, explorerPrompts),
  });
  const implementer = new Agent({
    id: 'implementer',
    name: 'implementer',
    description: 'Implements fixes',
    instructions: 'Implement.',
    model: makeSubAgentModel('Fixed.', implementerPrompts),
  });
  const supervisor = new Agent({
    id: 'supervisor',
    name: 'supervisor',
    instructions: 'Delegate.',
    model: makeSupervisorModel(calls, supervisorPrompts),
    agents: { explorer, implementer },
  });

  return { supervisor, explorer, implementer, explorerPrompts, implementerPrompts, supervisorPrompts };
}

describe('delegation result references — helpers', () => {
  it('mints deterministic per-agent ids', () => {
    const registry = createDelegationRefRegistry();
    expect(registry.register('explorer', 'a')).toBe('explorer-1');
    expect(registry.register('explorer', 'b')).toBe('explorer-2');
    expect(registry.register('implementer', 'c')).toBe('implementer-1');
    expect(registry.get('explorer-2')).toEqual({ text: 'b', agentName: 'explorer' });
  });

  it('returns the prompt unchanged when no refs are given', () => {
    const registry = createDelegationRefRegistry();
    expect(resolveDelegationRefs(registry, undefined, 'p')).toEqual({ prompt: 'p', missing: [], resolved: [] });
    expect(resolveDelegationRefs(registry, [], 'p')).toEqual({ prompt: 'p', missing: [], resolved: [] });
  });

  it('prepends labeled blocks in order and keeps the prompt last', () => {
    const registry = createDelegationRefRegistry();
    registry.register('explorer', 'first');
    registry.register('explorer', 'second');
    const { prompt, resolved } = resolveDelegationRefs(
      registry,
      ['explorer-2', { ref: 'explorer-1', as: 'earlier', note: 'see "this" <ok>' }],
      'Now fix it',
    );
    expect(resolved).toEqual(['explorer-2', 'explorer-1']);
    expect(prompt.indexOf('second')).toBeLessThan(prompt.indexOf('first'));
    expect(prompt.endsWith('\n\nNow fix it')).toBe(true);
    expect(prompt).toContain('ref="explorer-2" from="explorer"');
    expect(prompt).toContain('as="earlier" note="see &quot;this&quot; &lt;ok&gt;"');
  });

  it('skips unknown refs and reports them', () => {
    const registry = createDelegationRefRegistry();
    registry.register('explorer', 'x');
    const res = resolveDelegationRefs(registry, ['nope', 'explorer-1'], 'p');
    expect(res.missing).toEqual(['nope']);
    expect(res.resolved).toEqual(['explorer-1']);
    expect(res.prompt).toContain('x');

    const onlyMissing = resolveDelegationRefs(registry, ['nope'], 'p');
    expect(onlyMissing).toEqual({ prompt: 'p', missing: ['nope'], resolved: [] });
  });

  it('uses a fresh frame tag per block so a result cannot close another block', () => {
    const registry = createDelegationRefRegistry();
    registry.register('explorer', 'a');
    registry.register('explorer', 'b');
    const { prompt } = resolveDelegationRefs(registry, ['explorer-1', 'explorer-2'], 'p');
    const tags = [...prompt.matchAll(/<(delegation_result_[0-9a-f]+) /g)].map(m => m[1]);
    expect(tags).toHaveLength(2);
    expect(tags[0]).not.toBe(tags[1]);

    const again = resolveDelegationRefs(registry, ['explorer-1'], 'p').prompt;
    expect(again).not.toContain(tags[0]!);
  });
});

describe('delegation result references — agent integration', () => {
  it('is off by default: no contextFromRefs in the schema and no [ref:] trailer', async () => {
    const { supervisor, supervisorPrompts } = buildAgents([
      { toolName: 'agent-explorer', input: { prompt: 'Find the bug' } },
    ]);
    await supervisor.generate('go', { maxSteps: 3 });

    const results = toolResultTexts(supervisorPrompts[1]!);
    expect(results[0]).toBe(EXPLORER_FINDING);
    expect(results[0]).not.toContain('[ref:');

    const tools = await supervisor.listTools();
    expect(JSON.stringify(tools)).not.toContain('contextFromRefs');
  });

  it('relays an earlier result verbatim to a later delegation', async () => {
    const { supervisor, supervisorPrompts, implementerPrompts, explorerPrompts } = buildAgents([
      { toolName: 'agent-explorer', input: { prompt: 'Find the bug' } },
      {
        toolName: 'agent-implementer',
        input: { prompt: 'Fix the bug described above', contextFromRefs: ['explorer-1'] },
      },
    ]);
    await supervisor.generate('go', { maxSteps: 4, delegation: { enableResultReferences: true } });

    // Parent model sees the ref trailer after the explorer text.
    const firstResult = toolResultTexts(supervisorPrompts[1]!)[0];
    expect(firstResult).toBe(`${EXPLORER_FINDING}\n\n[ref: explorer-1]`);

    // Implementer receives the exact explorer text in a labeled block, then the prompt.
    const implementerPrompt = userText(implementerPrompts[0]!);
    expect(implementerPrompt).toContain(EXPLORER_FINDING);
    expect(implementerPrompt).toMatch(/<delegation_result_[0-9a-f]+ ref="explorer-1" from="explorer">/);
    expect(implementerPrompt.endsWith('Fix the bug described above')).toBe(true);
    expect(implementerPrompt.indexOf(EXPLORER_FINDING)).toBeLessThan(implementerPrompt.indexOf('Fix the bug'));

    // The explorer itself is not affected.
    expect(userText(explorerPrompts[0]!)).not.toContain('delegation_result_');

    // The implementer's own result gets its own ref.
    const secondResult = toolResultTexts(supervisorPrompts[2]!)[1];
    expect(secondResult).toBe('Fixed.\n\n[ref: implementer-1]');
  });

  it('supports the { ref, as, note } form', async () => {
    const { supervisor, implementerPrompts } = buildAgents([
      { toolName: 'agent-explorer', input: { prompt: 'Find the bug' } },
      {
        toolName: 'agent-implementer',
        input: {
          prompt: 'Fix it',
          contextFromRefs: [{ ref: 'explorer-1', as: 'investigation', note: 'the bug location' }],
        },
      },
    ]);
    await supervisor.generate('go', { maxSteps: 4, delegation: { enableResultReferences: true } });
    expect(userText(implementerPrompts[0]!)).toContain('as="investigation" note="the bug location"');
  });

  it('continues the delegation when a ref is unknown', async () => {
    const { supervisor, implementerPrompts } = buildAgents([
      { toolName: 'agent-implementer', input: { prompt: 'Fix it', contextFromRefs: ['explorer-9'] } },
    ]);
    await supervisor.generate('go', { maxSteps: 3, delegation: { enableResultReferences: true } });
    expect(userText(implementerPrompts[0]!).endsWith('Fix it')).toBe(true);
    expect(userText(implementerPrompts[0]!)).not.toContain('delegation_result_');
  });

  it('runs onDelegationStart on the expanded prompt and lets modifiedPrompt override it', async () => {
    const seenPrompts: string[] = [];
    const { supervisor, implementerPrompts } = buildAgents([
      { toolName: 'agent-explorer', input: { prompt: 'Find the bug' } },
      { toolName: 'agent-implementer', input: { prompt: 'Fix it', contextFromRefs: ['explorer-1'] } },
    ]);
    await supervisor.generate('go', {
      maxSteps: 4,
      delegation: {
        enableResultReferences: true,
        onDelegationStart: ctx => {
          seenPrompts.push(ctx.prompt);
          if (ctx.primitiveId === 'implementer') {
            return { proceed: true, modifiedPrompt: `${ctx.prompt}\nBe careful.` };
          }
        },
      },
    });
    expect(seenPrompts[1]).toContain(EXPLORER_FINDING);
    expect(userText(implementerPrompts[0]!)).toContain(EXPLORER_FINDING);
    expect(userText(implementerPrompts[0]!).endsWith('Be careful.')).toBe(true);
  });

  it('stores the hook-replaced resultText under the ref', async () => {
    const { supervisor, supervisorPrompts, implementerPrompts } = buildAgents([
      { toolName: 'agent-explorer', input: { prompt: 'Find the bug' } },
      { toolName: 'agent-implementer', input: { prompt: 'Fix it', contextFromRefs: ['explorer-1'] } },
    ]);
    await supervisor.generate('go', {
      maxSteps: 4,
      delegation: {
        enableResultReferences: true,
        onDelegationComplete: ctx => (ctx.primitiveId === 'explorer' ? { resultText: 'REPLACED' } : undefined),
      },
    });
    expect(toolResultTexts(supervisorPrompts[1]!)[0]).toBe('REPLACED\n\n[ref: explorer-1]');
    const implementerPrompt = userText(implementerPrompts[0]!);
    expect(implementerPrompt).toContain('REPLACED');
    expect(implementerPrompt).not.toContain(EXPLORER_FINDING);
  });

  it('does not mint a ref for an empty result', async () => {
    const { supervisor, supervisorPrompts } = buildAgents(
      [{ toolName: 'agent-explorer', input: { prompt: 'Find the bug' } }],
      { explorerReply: '' },
    );
    await supervisor.generate('go', { maxSteps: 3, delegation: { enableResultReferences: true } });
    expect(toolResultTexts(supervisorPrompts[1]!)[0]).not.toContain('[ref:');
  });

  it('exposes ref on the full result object when includeSubAgentToolResultsInModelContext is on', async () => {
    const { supervisor, supervisorPrompts } = buildAgents([
      { toolName: 'agent-explorer', input: { prompt: 'Find the bug' } },
    ]);
    await supervisor.generate('go', {
      maxSteps: 3,
      delegation: { enableResultReferences: true, includeSubAgentToolResultsInModelContext: true },
    });
    const raw = toolResultTexts(supervisorPrompts[1]!)[0]!;
    expect(JSON.parse(raw)).toMatchObject({ text: EXPLORER_FINDING, ref: 'explorer-1' });
  });

  it('keeps the flag-off schema intact after a flag-on run on the same agent', async () => {
    const { supervisor } = buildAgents([{ toolName: 'agent-explorer', input: { prompt: 'Find the bug' } }]);
    await supervisor.generate('go', { maxSteps: 3, delegation: { enableResultReferences: true } });
    const tools = await supervisor.listTools();
    expect(JSON.stringify(tools)).not.toContain('contextFromRefs');
  });
});
