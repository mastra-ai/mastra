import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateFsAgentsModule } from './codegen';
import { discoverFsAgents } from './discover';

/**
 * The rest of the fs-routing suite asserts on the *source* codegen emits. These
 * tests import and run it, which is the only way to catch an emit that is
 * syntactically valid text but broken as a module — an unresolvable import, a
 * malformed entry object, a schedule whose default export never survives the
 * round trip.
 *
 * Fixtures live inside the package rather than the OS temp dir so that bare
 * specifiers like `@mastra/core/agent` resolve through the workspace the same
 * way they do in a real project.
 */

/**
 * Resolved from this file, not from `process.cwd()`. The root runner invokes
 * vitest from the repo root, where `@mastra/core` is not resolvable, so a
 * cwd-relative fixture dir passes under `--filter ./packages/deployer` and
 * fails in CI.
 */
const PACKAGE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(PACKAGE_ROOT, '.tmp-fs-exec-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Write an agent dir. Schedules are `.js` so the emitted `.mjs` runs under plain ESM. */
async function writeAgent(
  name: string,
  files: { schedules?: Record<string, string>; subagents?: Record<string, Record<string, string>> } = {},
) {
  const agentDir = join(dir, 'agents', name);
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(agentDir, 'instructions.md'), `You are ${name}.`);
  await writeFile(join(agentDir, 'config.js'), `export default { model: 'openai/gpt-4o' };`);

  for (const [relPath, content] of Object.entries(files.schedules ?? {})) {
    const target = join(agentDir, 'schedules', relPath);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, content);
  }

  for (const [childName, schedules] of Object.entries(files.subagents ?? {})) {
    const childDir = join(agentDir, 'subagents', childName);
    await mkdir(join(childDir, 'schedules'), { recursive: true });
    await writeFile(join(childDir, 'instructions.md'), 'child');
    await writeFile(join(childDir, 'config.js'), `export default { model: 'openai/gpt-4o', description: 'child' };`);
    for (const [relPath, content] of Object.entries(schedules)) {
      await writeFile(join(childDir, 'schedules', relPath), content);
    }
  }
}

/** Emit the standalone wrapper for the discovered agents and import it. */
async function runGeneratedModule(suffix: string): Promise<any> {
  const agents = await discoverFsAgents(dir);
  const source = await generateFsAgentsModule(undefined, agents);
  const modPath = join(dir, `entry-${suffix}.mjs`);
  await writeFile(modPath, source);
  return import(pathToFileURL(modPath).href);
}

const scheduleModule = (body: string) =>
  `import { defineSchedule } from '@mastra/core/agent';\nexport default defineSchedule(${body});`;

describe('generated fs-agents module — executed, not just emitted', () => {
  it('registers a nested schedule onto the agent with its path-derived key', async () => {
    await writeAgent('support', {
      schedules: {
        'billing/sweep.js': scheduleModule(`{ cron: '0 3 * * *', prompt: 'Sweep unpaid invoices.' }`),
      },
    });

    const mod = await runGeneratedModule('nested');
    const declared = mod.mastra.getAgentById('support').getDeclaredSchedules();

    expect(declared.map((s: any) => s.key)).toEqual(['billing/sweep']);
    expect(declared[0].definition.prompt).toBe('Sweep unpaid invoices.');
  });

  it('inlines a markdown schedule so the deployed bundle reads no files', async () => {
    await writeAgent('support', {
      schedules: { 'cleanup.md': `---\ncron: "0 3 * * *"\nname: "nightly"\n---\n\nClose resolved tickets.` },
    });

    const mod = await runGeneratedModule('markdown');
    const declared = mod.mastra.getAgentById('support').getDeclaredSchedules();

    expect(declared[0].key).toBe('cleanup');
    expect(declared[0].definition).toMatchObject({
      cron: '0 3 * * *',
      name: 'nightly',
      prompt: 'Close resolved tickets.',
    });
  });

  it('keeps a handler-mode schedule callable through codegen', async () => {
    await writeAgent('support', {
      schedules: {
        'sweep.js': scheduleModule(`{ cron: '0 3 * * *', handler: async () => ({ prompt: 'computed' }) }`),
      },
    });

    const mod = await runGeneratedModule('handler');
    const declared = mod.mastra.getAgentById('support').getDeclaredSchedules();

    // Importing (rather than inlining) the module is the whole reason handler
    // mode works: the function has to survive as a live reference.
    expect(typeof declared[0].definition.handler).toBe('function');
    await expect(declared[0].definition.handler({} as any)).resolves.toEqual({ prompt: 'computed' });
  });

  it('mixes markdown and module schedules on one agent', async () => {
    await writeAgent('support', {
      schedules: {
        'heartbeat.js': scheduleModule(`{ cron: '*/5 * * * *', prompt: 'Check health.' }`),
        'cleanup.md': `---\ncron: "0 3 * * *"\n---\n\nClose resolved tickets.`,
      },
    });

    const mod = await runGeneratedModule('mixed');
    const declared = mod.mastra.getAgentById('support').getDeclaredSchedules();

    expect(declared.map((s: any) => s.key).sort()).toEqual(['cleanup', 'heartbeat']);
  });

  it('fails at module evaluation when a schedule is invalid, naming the file', async () => {
    await writeAgent('support', {
      schedules: { 'broken.md': `---\ncron: "not a cron"\n---\n\nbody` },
    });

    await expect(runGeneratedModule('invalid')).rejects.toThrow(/agents\/support\/schedules\/broken/);
  });

  it('fails at module evaluation when a subagent declares schedules', async () => {
    await writeAgent('support', {
      subagents: { researcher: { 'heartbeat.js': scheduleModule(`{ cron: '0 3 * * *', prompt: 'hi' }`) } },
    });

    await expect(runGeneratedModule('subagent')).rejects.toThrow(/only supported on root agents/);
  });
});
