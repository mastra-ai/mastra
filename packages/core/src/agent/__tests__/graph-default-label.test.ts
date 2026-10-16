import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { MASTRA_VERSIONS_KEY, RequestContext } from '../../request-context';
import { Agent } from '../agent';
import { getAgentVersionPins } from '../version-pins';

function textModel(onGenerate?: () => void) {
  return new MockLanguageModelV2({
    doGenerate: async () => {
      onGenerate?.();
      return {
        content: [{ type: 'text' as const, text: 'done' }],
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text' },
        { type: 'text-delta', id: 'text', delta: 'done' },
        { type: 'text-end', id: 'text' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

function delegatingModel(onDelegate: () => void, tool = 'child', repeat = true) {
  let call = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      const delegate = repeat ? call++ % 2 === 0 : call++ === 0;
      if (delegate) onDelegate();
      return {
        content: delegate
          ? [
              {
                type: 'tool-call' as const,
                toolCallId: `call-${call}`,
                toolName: `agent-${tool}`,
                input: '{"prompt":"help"}',
              },
            ]
          : [{ type: 'text' as const, text: 'done' }],
        finishReason: delegate ? ('tool-calls' as const) : ('stop' as const),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
  });
}

function codeAgent(id: string, agents: Record<string, Agent> = {}, onGenerate?: () => void) {
  return new Agent({ id, name: id, instructions: id, model: textModel(onGenerate), agents });
}

function versionEditor(target: (agent: Agent, selector: any) => string, onResolve?: (agent: Agent) => void) {
  return {
    agent: {
      applyStoredOverrides: vi.fn(async (agent: Agent, selector: any) => {
        const versionId = selector.versionId ?? target(agent, selector);
        const fork = agent.__fork();
        fork.__setRawConfig({ resolvedVersionId: versionId });
        onResolve?.(fork);
        return fork;
      }),
    },
  };
}

describe('graph-wide default labels', () => {
  it.each(['generate', 'stream'] as const)(
    'replaces selector kinds atomically between defaults and %s call options',
    async method => {
      const root = new Agent({
        id: 'root',
        name: 'root',
        instructions: 'root',
        model: textModel(),
        defaultOptions: { versions: { agents: { root: { versionId: 'old-version' } } } },
      });
      const editor = versionEditor(() => 'root-candidate');
      new Mastra({ agents: { root }, editor: editor as any });

      const output = await root[method]('start', { versions: { agents: { root: { label: 'candidate' } } } });
      if ('fullStream' in output)
        for await (const _chunk of output.fullStream) {
          /* Drain. */
        }

      expect(editor.agent.applyStoredOverrides.mock.calls.map(([, selector]) => selector)).toEqual([
        { label: 'candidate' },
      ]);
    },
  );

  it.each(['root', 'child'])(
    'restores caller policy when %s label resolution fails before execution',
    async failingId => {
      const child = codeAgent('child');
      const root = codeAgent('root', { child });
      const editor = versionEditor(agent => {
        if (agent.id === failingId) throw new Error('VERSION_LABEL_NOT_FOUND');
        return `${agent.id}-v1`;
      });
      new Mastra({ agents: { root }, editor: editor as any });
      const requestContext = new RequestContext();

      await expect(root.generate('fail', { requestContext, versions: { defaultLabel: 'missing' } })).rejects.toThrow(
        'VERSION_LABEL_NOT_FOUND',
      );
      expect(requestContext.get(MASTRA_VERSIONS_KEY)).toBeUndefined();
      editor.agent.applyStoredOverrides.mockClear();
      await expect(root.generate('fresh', { requestContext })).resolves.toMatchObject({ text: 'done' });
      expect(editor.agent.applyStoredOverrides).not.toHaveBeenCalled();
    },
  );

  it('preserves the root pin when cyclic delegation returns through a child after labels move', async () => {
    let target = 'v1';
    const rootVersions: Array<string | undefined> = [];
    const child = new Agent({
      id: 'child',
      name: 'child',
      instructions: 'child',
      agents: () => ({ parent: root }),
      model: delegatingModel(
        () => {
          target = 'v2';
        },
        'parent',
        false,
      ),
    });
    const root: Agent = new Agent({
      id: 'root',
      name: 'root',
      instructions: ({ requestContext }) => {
        rootVersions.push(getAgentVersionPins(requestContext)?.root?.versionId);
        return 'root';
      },
      agents: { child },
      model: delegatingModel(() => {}, 'child', false),
    });
    const editor = versionEditor(agent => `${agent.id}-${target}`);
    new Mastra({ agents: { root }, editor: editor as any });

    await root.generate('start', { maxSteps: 3, versions: { defaultLabel: 'candidate' } });

    expect(rootVersions).toEqual(['root-v1', 'root-v1']);
    expect(
      editor.agent.applyStoredOverrides.mock.calls.filter(([, selector]) => selector.label).map(([agent]) => agent.id),
    ).toEqual(['root', 'child']);
  });

  it('lets a fresh default label replace a prehydrated root without recursive label lookups', async () => {
    const child = codeAgent('child');
    const root = codeAgent('root', { child });
    const editor = versionEditor((agent, selector) => `${agent.id}-${selector.label}`);
    const mastra = new Mastra({ agents: { root }, editor: editor as any });
    const prehydrated = await mastra.resolveVersionedAgent(root, { label: 'old' });
    editor.agent.applyStoredOverrides.mockClear();
    const requestContext = new RequestContext();

    await prehydrated.generate('start', { requestContext, versions: { defaultLabel: 'candidate' } });

    expect(getAgentVersionPins(requestContext)).toMatchObject({
      root: { versionId: 'root-candidate' },
      agents: { child: { versionId: 'child-candidate' } },
    });
    expect(
      editor.agent.applyStoredOverrides.mock.calls.filter(([, selector]) => selector.label).map(([agent]) => agent.id),
    ).toEqual(['root', 'child']);
  });

  it('keeps a delegated child pinned when labels move after routing begins, then refreshes the next run', async () => {
    let target = 'v1';
    const childVersions: Array<string | undefined> = [];
    const child = new Agent({
      id: 'child',
      name: 'child',
      instructions: ({ requestContext }) => {
        childVersions.push(getAgentVersionPins(requestContext)?.root?.versionId);
        return 'child';
      },
      model: textModel(),
    });
    const root = new Agent({
      id: 'root',
      name: 'root',
      instructions: 'delegate',
      agents: { child },
      model: delegatingModel(() => {
        target = 'v2';
      }),
    });
    const editor = versionEditor(agent => `${agent.id}-${target}`);
    new Mastra({ agents: { root }, versions: { defaultLabel: 'candidate' }, editor: editor as any });
    const requestContext = new RequestContext();

    await root.generate('start', { requestContext, maxSteps: 3 });
    expect(childVersions).toEqual(['child-v1']);
    const firstRunLabels = editor.agent.applyStoredOverrides.mock.calls.filter(([, selector]) => selector.label);
    expect(firstRunLabels.map(([agent]) => agent.id)).toEqual(['root', 'child']);
    await root.generate('start again', { requestContext, maxSteps: 3 });
    expect(childVersions).toEqual(['child-v1', 'child-v2']);
  });

  it('keeps a code fallback frozen when a status override appears after the run begins', async () => {
    let published = false;
    const childVersions: Array<string | undefined> = [];
    const child = new Agent({
      id: 'child',
      name: 'child',
      instructions: ({ requestContext }) => {
        childVersions.push(getAgentVersionPins(requestContext)?.root?.versionId);
        return 'child';
      },
      model: textModel(),
    });
    const root = new Agent({
      id: 'root',
      name: 'root',
      instructions: 'delegate',
      agents: { child },
      model: delegatingModel(() => {
        published = true;
      }),
    });
    const applyStoredOverrides = vi.fn(async (agent: Agent, selector: any) => {
      if (agent.id === 'child' && !published) return agent;
      const fork = agent.__fork();
      fork.__setRawConfig({ resolvedVersionId: selector.versionId ?? `${agent.id}-v1` });
      return fork;
    });
    new Mastra({ agents: { root }, editor: { agent: { applyStoredOverrides } } as any });

    await root.generate('start', { maxSteps: 3, versions: { defaultStatus: 'published' } });

    expect(childVersions).toEqual([undefined]);
    expect(applyStoredOverrides.mock.calls.filter(([agent]) => agent.id === 'child')).toHaveLength(1);
  });

  it('fails closed when a dynamic dependency appears after the default-label graph was pinned', async () => {
    let addLate = false;
    const child = codeAgent('child');
    const late = codeAgent('late');
    const behavior = vi.fn();
    const root = new Agent({
      id: 'root',
      name: 'root',
      instructions: 'root',
      model: textModel(behavior),
      agents: () => (addLate ? { child, late } : { child }),
    });
    const editor = versionEditor(agent => {
      if (agent.id === 'child') addLate = true;
      return `${agent.id}-v1`;
    });
    new Mastra({ agents: { root }, editor: editor as any });

    await expect(root.generate('start', { versions: { defaultLabel: 'candidate' } })).rejects.toThrow('was not pinned');
    expect(behavior).not.toHaveBeenCalled();
    expect(editor.agent.applyStoredOverrides.mock.calls.some(([agent]) => agent.id === 'late')).toBe(false);
  });

  it('pins root, nested dependencies and their explicit overrides before model behavior', async () => {
    const context = new RequestContext();
    const beforeBehavior = vi.fn(() => {
      expect(getAgentVersionPins(context)).toMatchObject({
        root: { agentId: 'root', versionId: 'root-candidate' },
        agents: {
          child: { versionId: 'child-candidate' },
          grandchild: { versionId: 'grandchild-exact' },
        },
      });
    });
    const grandchild = codeAgent('grandchild');
    const child = codeAgent('child', { grandchild });
    const root = codeAgent('root', { child }, beforeBehavior);
    const editor = versionEditor((agent, selector) => `${agent.id}-${selector.label ?? selector.status}`);
    new Mastra({ agents: { root }, editor: editor as any });

    await root.generate('start', {
      requestContext: context,
      versions: {
        defaultLabel: 'candidate',
        defaultStatus: 'published',
        agents: { grandchild: { versionId: 'grandchild-exact' } },
      },
    });

    expect(beforeBehavior).toHaveBeenCalledOnce();
    expect(
      editor.agent.applyStoredOverrides.mock.calls.map(([agent, selector]) => [agent.id, selector]),
    ).toContainEqual(['grandchild', { versionId: 'grandchild-exact' }]);
    expect(editor.agent.applyStoredOverrides.mock.calls.some(([, selector]) => selector.status)).toBe(false);
  });

  it('uses the selected configuration for graph traversal and handles cycles', async () => {
    const obsolete = codeAgent('obsolete');
    const added = codeAgent('added');
    const child = codeAgent('child', { obsolete });
    const root = codeAgent('root', { child });
    const editor = versionEditor(
      agent => `${agent.id}-v1`,
      agent => {
        if (agent.id === 'child') vi.spyOn(agent, 'listAgents').mockReturnValue({ added, root });
      },
    );
    new Mastra({ agents: { root, added }, editor: editor as any });
    const context = new RequestContext();

    await root.generate('start', { requestContext: context, versions: { defaultLabel: 'candidate' } });

    expect(getAgentVersionPins(context)).toMatchObject({
      root: { agentId: 'root', versionId: 'root-v1' },
      agents: { child: { versionId: 'child-v1' }, added: { versionId: 'added-v1' } },
    });
    const labelCalls = editor.agent.applyStoredOverrides.mock.calls
      .filter(([, selector]) => selector.label)
      .map(([agent]) => agent.id);
    expect(labelCalls).toEqual(['root', 'child', 'added']);
    expect(labelCalls).not.toContain('obsolete');
  });

  it('fails before model behavior when a dependency is missing the default label', async () => {
    const behavior = vi.fn();
    const child = codeAgent('child');
    const root = codeAgent('root', { child }, behavior);
    const editor = versionEditor(agent => {
      if (agent.id === 'child') throw new Error('VERSION_LABEL_NOT_FOUND');
      return 'root-v1';
    });
    new Mastra({ agents: { root }, editor: editor as any });

    await expect(root.generate('start', { versions: { defaultLabel: 'candidate' } })).rejects.toThrow(
      'VERSION_LABEL_NOT_FOUND',
    );
    expect(behavior).not.toHaveBeenCalled();
  });

  it('keeps a root-only override from becoming a dependency default', async () => {
    const child = codeAgent('child');
    const root = codeAgent('root', { child });
    const editor = versionEditor(agent => `${agent.id}-v1`);
    new Mastra({ agents: { root }, editor: editor as any });

    await root.generate('start', { versions: { agents: { root: { versionId: 'root-v1' } } } });

    expect(editor.agent.applyStoredOverrides.mock.calls.map(([agent]) => agent.id)).toEqual(['root']);
  });

  it('resolves moved defaults again for a new run with the same caller context', async () => {
    let target = 'v1';
    const child = codeAgent('child');
    const root = codeAgent('root', { child });
    const editor = versionEditor(agent => `${agent.id}-${target}`);
    new Mastra({ agents: { root }, editor: editor as any });
    const context = new RequestContext();
    const versions = { defaultLabel: 'candidate' };
    context.set(MASTRA_VERSIONS_KEY, versions);

    await root.generate('start', { requestContext: context });
    expect(getAgentVersionPins(context)?.root?.versionId).toBe('root-v1');
    expect(context.get(MASTRA_VERSIONS_KEY)).toBe(versions);
    target = 'v2';
    await root.generate('start again', { requestContext: context });

    expect(getAgentVersionPins(context)).toMatchObject({
      root: { versionId: 'root-v2' },
      agents: { child: { versionId: 'child-v2' } },
    });
    expect(context.get(MASTRA_VERSIONS_KEY)).toBe(versions);
  });
});
