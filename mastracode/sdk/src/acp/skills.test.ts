import type { AgentSideConnection, SessionNotification } from '@agentclientprotocol/sdk';
import type { AgentController, AgentControllerEvent, Session } from '@mastra/core/agent-controller';
import type { Skill } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';
import { MastraCodeAcpAgent } from './agent.js';

function skill(name: string, fields: Partial<Skill> = {}): Skill {
  return {
    name,
    description: `Use ${name}`,
    path: `/project/.agents/skills/${name}`,
    instructions: 'Review the changes.',
    source: { type: 'local', projectPath: '/project' },
    references: ['checklist.md'],
    scripts: [],
    assets: [],
    ...fields,
  };
}

function runtime(id: string, catalog: Skill[]) {
  let emit: (event: AgentControllerEvent) => void = () => {};
  const sent: string[] = [];
  const skills = {
    list: async () => catalog,
    get: vi.fn(async (name: string) => catalog.find(item => item.name === name || item.path === name) ?? null),
    maybeRefresh: async () => {},
  };
  return {
    controller: { listAvailableModels: async () => [] } as unknown as AgentController,
    modes: [],
    getSkills: async () => skills,
    skills,
    sent,
    session: {
      thread: { create: async () => ({ id }), switch: async () => {} },
      mode: { get: () => 'build' },
      model: { get: () => '' },
      subscribe: (listener: typeof emit) => {
        emit = listener;
        return () => {};
      },
      abort: () => emit({ type: 'agent_end', reason: 'aborted' }),
      sendMessage: async ({ content }: { content: string }) => {
        sent.push(content);
        emit({ type: 'agent_end', reason: 'complete' });
      },
    } as unknown as Session,
  };
}

async function setup(catalog = [skill('review')]) {
  const state = runtime('one', catalog);
  const updates: SessionNotification[] = [];
  const connection = {
    sessionUpdate: async (update: SessionNotification) => {
      updates.push(update);
    },
  };
  const agent = new MastraCodeAcpAgent(connection as AgentSideConnection, async () => state);
  await agent.newSession({ cwd: '/project', mcpServers: [] });
  await new Promise<void>(resolve => setImmediate(resolve));
  const prompt = (text: string) => agent.prompt({ sessionId: 'one', prompt: [{ type: 'text', text }] });
  return { agent, state, updates, prompt };
}

describe('ACP skill commands', () => {
  it('invokes the first visible file when copied skills have the same name', async () => {
    const first = skill('review');
    const copy = skill('review', { path: '/other/skills/review', instructions: 'Other copy' });
    const { state, prompt } = await setup([first, copy]);
    state.skills.get.mockImplementation(async name => {
      if (name === 'review') throw new Error('Multiple local skills found');
      return [first, copy].find(item => item.path === name) ?? null;
    });
    await expect(prompt('/skill/review')).resolves.toMatchObject({ stopReason: 'end_turn' });
    expect(state.sent[0]).toContain('Review the changes.');
    expect(state.sent[0]).not.toContain('Other copy');
  });
  it('advertises invokable skills once per name without exposing hidden instructions', async () => {
    const { updates } = await setup([skill('review'), skill('hidden', { 'user-invocable': false }), skill('review')]);
    expect(updates).toContainEqual({
      sessionId: 'one',
      update: {
        sessionUpdate: 'available_commands_update',
        availableCommands: [
          { name: 'skill/review', description: 'Use review', input: { hint: 'Additional instructions' } },
        ],
      },
    });
    expect(JSON.stringify(updates)).not.toContain('Review the changes.');
  });

  it('expands a skill using its instructions, resources, and multiline arguments', async () => {
    const { state, prompt } = await setup();
    await expect(prompt('/skill/review inspect src\nkeep it brief')).resolves.toMatchObject({ stopReason: 'end_turn' });
    expect(state.sent).toEqual([
      '<skill name="review">\nReview the changes.\n\n## References\n- references/checklist.md\n\nARGUMENTS: inspect src\nkeep it brief\n</skill>',
    ]);
  });

  it.each(['hidden', 'missing', '../review', ''])(
    'rejects unavailable skill %j without starting inference',
    async name => {
      const { state, prompt } = await setup([skill('hidden', { 'user-invocable': false })]);
      await expect(prompt(`/skill/${name}`)).rejects.toMatchObject({ code: -32602 });
      expect(state.sent).toEqual([]);
    },
  );

  it('leaves normal prompts and non-skill slash commands unchanged', async () => {
    const { state, prompt } = await setup();
    await prompt('Explain /skill/review');
    await prompt('/goal make a plan');
    expect(state.sent).toEqual(['Explain /skill/review', '/goal make a plan']);
  });

  it('refreshes the advertised commands and refuses a skill removed since discovery', async () => {
    const catalog = [skill('review')];
    const { state, updates, prompt } = await setup(catalog);
    catalog.splice(0);
    await expect(prompt('/skill/review')).rejects.toMatchObject({ code: -32602 });
    expect(updates.at(-1)?.update).toEqual({ sessionUpdate: 'available_commands_update', availableCommands: [] });
    expect(state.sent).toEqual([]);
  });

  it('does not execute a skill after cancellation during loading', async () => {
    const { agent, state, prompt } = await setup();
    const loaded = Promise.withResolvers<Skill | null>();
    state.skills.get.mockReturnValueOnce(loaded.promise);
    const turn = prompt('/skill/review');
    await vi.waitFor(() => expect(state.skills.get).toHaveBeenCalled());
    await agent.cancel({ sessionId: 'one' });
    loaded.resolve(skill('review'));
    await expect(turn).resolves.toMatchObject({ stopReason: 'cancelled' });
    expect(state.sent).toEqual([]);
  });

  it('resolves the same command against each session independently', async () => {
    const first = runtime('one', [skill('review', { instructions: 'First workspace' })]);
    const second = runtime('two', [skill('review', { instructions: 'Second workspace' })]);
    const agent = new MastraCodeAcpAgent(
      { sessionUpdate: async () => {} } as unknown as AgentSideConnection,
      async request => (request.cwd === '/one' ? first : second),
    );
    await agent.newSession({ cwd: '/one', mcpServers: [] });
    await agent.newSession({ cwd: '/two', mcpServers: [] });
    await Promise.all(
      ['one', 'two'].map(sessionId => agent.prompt({ sessionId, prompt: [{ type: 'text', text: '/skill/review' }] })),
    );
    expect(first.sent[0]).toContain('First workspace');
    expect(second.sent[0]).toContain('Second workspace');
    expect(first.sent[0]).not.toContain('Second workspace');
  });
});
