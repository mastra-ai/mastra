import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mastraCli, startPlatformApi } from '../platform/__fixtures__/platform-api.js';

let platform: Awaited<ReturnType<typeof startPlatformApi>>;
let cli: Awaited<ReturnType<typeof mastraCli>>;

beforeAll(async () => {
  platform = await startPlatformApi();
});
afterAll(() => platform.close());

beforeEach(async () => {
  cli = await mastraCli(platform.url);
  cli.env.MASTRA_PROJECT_ID = (await cli.json<{ id: string }>(['projects', 'create', 'Support Desk'])).id;
});

describe('mastra agents', () => {
  it('creates an agent in a new project and streams its reply to an end user', async () => {
    const agent = await cli.json<{ id: string }>([
      'agents',
      'create',
      '--name',
      'Support',
      '--instructions',
      'Answer billing questions.',
    ]);
    expect((await cli.json<{ name: string }[]>(['agents', 'list'])).map(a => a.name)).toEqual(['Support']);

    const run = await cli.run(['agents', 'run', agent.id, 'Where is my invoice?', '--resource', 'user-1']);
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toBe('Support here. You asked: Where is my invoice?');
  }, 120_000);

  it('chats with an agent over several turns in one remembered thread', async () => {
    const agent = await cli.json<{ id: string }>(['agents', 'create', '--name', 'Support', '--instructions', 'Hi']);

    const chat = await cli.run(
      ['agents', 'chat', agent.id, '--resource', 'user-1'],
      {},
      'Where is my invoice?\n\nIt was for March\n/exit\nnever sent\n',
    );
    expect(chat.exitCode, chat.stderr).toBe(0);
    expect(chat.stdout).toContain('Support here. You asked: Where is my invoice?');
    expect(chat.stdout).toContain('You asked: It was for March (earlier you said: Where is my invoice?)');
    expect(chat.stdout).not.toContain('never sent');

    const [thread, history] = [...platform.threads].at(-1)!;
    expect(history).toEqual({ resource: 'user-1', messages: ['Where is my invoice?', 'It was for March'] });

    // The printed resume command continues the same conversation.
    expect(chat.stdout).toContain(`mastra agents chat ${agent.id} --resource user-1 --thread ${thread}`);
    const resumed = await cli.run(
      ['agents', 'chat', agent.id, '--resource', 'user-1', '--thread', thread],
      {},
      'Thanks',
    );
    expect(resumed.stdout).toContain('(earlier you said: It was for March)');
  }, 120_000);

  it('ends the chat when input ends', async () => {
    const agent = await cli.json<{ id: string }>(['agents', 'create', '--name', 'Support', '--instructions', 'Hi']);
    const chat = await cli.run(['agents', 'chat', agent.id, '--resource', 'user-1'], {}, 'Hello');
    expect(chat.exitCode, chat.stderr).toBe(0);
    expect(chat.stdout).toContain('You asked: Hello');
  }, 120_000);

  it('sets every agent option from flags', async () => {
    const agent = await cli.json<{ id: string }>([
      'agents',
      'create',
      '--name',
      'Support',
      '--instructions',
      'Hi',
      '--description',
      'Billing help',
      '--model',
      'openai/gpt-5-mini',
      '--connection',
      'conn_1',
      '--connection',
      'conn_2',
      '--skill',
      'skill_1',
      '--builtin-tool',
      'list_agents',
      '--no-code-mode',
    ]);
    expect(platform.agents.get(agent.id)).toMatchObject({
      description: 'Billing help',
      model: { provider: 'mastra', name: 'openai/gpt-5-mini' },
      connectionIds: ['conn_1', 'conn_2'],
      skillIds: ['skill_1'],
      builtinTools: ['list_agents'],
      codeMode: false,
    });
  }, 120_000);

  it('deletes an agent', async () => {
    const agent = await cli.json<{ id: string }>(['agents', 'create', '--name', 'Temp', '--instructions', 'Hi']);
    await cli.json(['agents', 'delete', agent.id]);
    expect(await cli.json<unknown[]>(['agents', 'list'])).toEqual([]);
    expect(platform.agents.has(agent.id)).toBe(false);
  }, 120_000);

  it("prints the Platform's reason and exits non-zero when a request is refused", async () => {
    await cli.json(['agents', 'setup']);
    const result = await cli.run(['agents', 'run', 'agent_missing', 'Hello', '--resource', 'user-1']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Agent not found');
  }, 120_000);

  it('exits non-zero with the reason when a run fails partway through the reply', async () => {
    const agent = await cli.json<{ id: string }>(['agents', 'create', '--name', 'Support', '--instructions', 'Hi']);
    const result = await cli.run(['agents', 'run', agent.id, 'Are you overloaded?', '--resource', 'user-1']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('Let me ');
    expect(result.stderr).toContain('Model provider overloaded');
  }, 120_000);

  it('asks for a project when none is given, set or linked', async () => {
    delete cli.env.MASTRA_PROJECT_ID;
    const result = await cli.run(['agents', 'list']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No project selected');
    expect(result.stderr).toContain('mastra projects create');
  }, 60_000);
});
