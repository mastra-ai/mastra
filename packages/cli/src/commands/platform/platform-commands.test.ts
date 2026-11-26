import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mastraCli, startPlatformApi } from './__fixtures__/platform-api.js';

let platform: Awaited<ReturnType<typeof startPlatformApi>>;
let cli: Awaited<ReturnType<typeof mastraCli>>;
let projectId: string;

beforeAll(async () => {
  platform = await startPlatformApi();
});
afterAll(() => platform.close());

beforeEach(async () => {
  cli = await mastraCli(platform.url);
  projectId = (await cli.json<{ id: string }>(['projects', 'create', 'Research Bot'])).id;
  cli.env.MASTRA_PROJECT_ID = projectId;
});

describe('mastra projects', () => {
  it('creates, lists and deletes projects in the organization', async () => {
    const listed = await cli.json<{ id: string; slug: string }[]>(['projects', 'list']);
    expect(listed).toContainEqual(expect.objectContaining({ id: projectId, slug: 'research-bot' }));

    await cli.json(['projects', 'delete', projectId]);
    expect(platform.projects.has(projectId)).toBe(false);
  }, 120_000);

  it('targets a project by its slug', async () => {
    delete cli.env.MASTRA_PROJECT_ID;
    const memory = await cli.json<{ id: string }>(['memory', 'create', 'notes', '--project', 'research-bot']);
    expect(platform.resources.get(memory.id)?.projectId).toBe(projectId);
  }, 120_000);
});

describe('provisioning commands', () => {
  it('waits for Memory, Knowledge and file systems to be ready', async () => {
    const memory = await cli.json<{ id: string; status: string }>(['memory', 'create', 'notes']);
    const knowledge = await cli.json<{ id: string; status: string }>(['knowledge', 'create']);
    const filesystem = await cli.json<{ id: string; status: string }>(['filesystems', 'create', 'uploads']);
    expect([memory.status, knowledge.status, filesystem.status]).toEqual(['ready', 'ready', 'ready']);

    expect((await cli.json<{ id: string }[]>(['memory', 'list'])).map(i => i.id)).toEqual([memory.id]);
    expect((await cli.json<{ id: string }[]>(['knowledge', 'list'])).map(i => i.id)).toEqual([knowledge.id]);
    expect((await cli.json<{ id: string }[]>(['filesystems', 'list'])).map(i => i.id)).toEqual([filesystem.id]);
  }, 180_000);

  it('returns while still provisioning with --no-wait', async () => {
    const memory = await cli.json<{ status: string }>(['memory', 'create', 'notes', '--no-wait']);
    expect(memory.status).toBe('provisioning');
  }, 60_000);

  it('tells the user which variable to set after provisioning', async () => {
    const result = await cli.run(['memory', 'create', 'notes']);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/MASTRA_MEMORY_INSTANCE_ID=memory_\d+/);
  }, 60_000);

  it('deletes a Memory instance', async () => {
    const memory = await cli.json<{ id: string }>(['memory', 'create', 'notes']);
    await cli.json(['memory', 'delete', memory.id]);
    expect(platform.resources.has(memory.id)).toBe(false);
  }, 120_000);
});

describe('mastra sandboxes', () => {
  it('starts a sandbox, runs commands in it, and destroys it', async () => {
    const sandbox = await cli.json<{ id: string }>(['sandboxes', 'create']);
    expect((await cli.json<{ id: string }[]>(['sandboxes', 'list'])).map(s => s.id)).toEqual([sandbox.id]);

    const echo = await cli.run(['sandboxes', 'exec', sandbox.id, '--', 'echo', 'hello', 'world']);
    expect(echo.exitCode, echo.stderr).toBe(0);
    expect(echo.stdout).toBe('hello world');

    const pwd = await cli.run(['sandboxes', 'exec', sandbox.id, '--cwd', '/srv/app', '--', 'pwd']);
    expect(pwd.stdout).toBe('/srv/app');
    expect(platform.commands.map(c => c.sandboxId)).toEqual([sandbox.id, sandbox.id]);

    await cli.json(['sandboxes', 'destroy', sandbox.id]);
    expect(platform.sandboxes.get(sandbox.id)?.status).toBe('destroyed');
    expect(await cli.json<unknown[]>(['sandboxes', 'list'])).toEqual([]);
  }, 180_000);

  it("exits with the command's exit code and shows its errors", async () => {
    const sandbox = await cli.json<{ id: string }>(['sandboxes', 'create']);
    const result = await cli.run(['sandboxes', 'exec', sandbox.id, '--', 'nope']);
    expect(result.exitCode).toBe(127);
    expect(result.stderr).toContain('nope: command not found');
  }, 120_000);

  it('sets sandbox and command options from flags', async () => {
    const sandbox = await cli.json<{ id: string }>([
      'sandboxes',
      'create',
      '--idle-timeout',
      '30',
      '--public-ports',
      '--network-isolation',
      'PRIVATE',
    ]);
    expect(platform.sandboxes.get(sandbox.id)?.request).toMatchObject({
      idleTimeoutMinutes: 30,
      publicPorts: true,
      networkIsolation: 'PRIVATE',
    });

    const env = await cli.run(['sandboxes', 'exec', sandbox.id, '--var', 'GREETING=a=b', '--', 'printenv', 'GREETING']);
    expect(env.stdout).toBe('a=b');

    const slow = await cli.run(['sandboxes', 'exec', sandbox.id, '--timeout', '1', '--', 'sleep', '60']);
    expect(slow.exitCode).toBe(124);

    const bad = await cli.run(['sandboxes', 'exec', sandbox.id, '--var', 'NOVALUE', '--', 'echo']);
    expect(bad.exitCode).toBe(1);
    expect(bad.stderr).toContain('--var expects KEY=VALUE');
  }, 180_000);

  it('fails instead of starting a new sandbox when the id is wrong', async () => {
    const before = platform.sandboxes.size;
    const result = await cli.run(['sandboxes', 'exec', 'sbx_typo', '--', 'echo', 'hi']);
    expect(result.exitCode).toBe(1);
    expect(platform.sandboxes.size).toBe(before);
    expect(platform.commands).not.toContainEqual(expect.objectContaining({ command: 'echo hi' }));
  }, 60_000);
});
