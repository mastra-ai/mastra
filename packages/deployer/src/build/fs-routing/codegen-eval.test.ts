import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateFsAgentsModule } from './codegen';
import type { DiscoveredFsAgent } from './discover';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fs-routing-eval-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('generated module evaluation', () => {
  it('imports the user entry, assembles agents, and registers them', async () => {
    // Stub @mastra/core/agent so we do not need to construct a real Agent.
    const coreStub = join(dir, 'core-agent.mjs');
    await writeFile(
      coreStub,
      `export function assembleAgentFromFsEntry(entry) {
         return { id: entry.config?.id ?? entry.name, name: entry.name, __entry: entry };
       }`,
    );

    // Stub user entry exposing a mastra with __registerFsAgents.
    const userEntry = join(dir, 'index.mjs');
    await writeFile(
      userEntry,
      `const registered = {};
       export const mastra = {
         registered,
         getLogger() { return { warn() {} }; },
         __registerFsAgents(map) { Object.assign(registered, map); },
       };
       export const extra = 'kept';`,
    );

    // Stub config + tool modules for one agent.
    const agentDir = join(dir, 'agents', 'weather');
    await mkdir(join(agentDir, 'tools'), { recursive: true });
    await writeFile(join(agentDir, 'config.mjs'), `export default { model: 'm' };`);
    await writeFile(join(agentDir, 'tools', 'get_weather.mjs'), `export default { id: 'get_weather' };`);

    const agents: DiscoveredFsAgent[] = [
      {
        name: 'weather',
        dir: agentDir,
        configPath: join(agentDir, 'config.mjs'),
        instructionsPath: undefined,
        tools: [{ key: 'get_weather', path: join(agentDir, 'tools', 'get_weather.mjs') }],
        skills: [],
        subagents: [],
      },
    ];

    let source = await generateFsAgentsModule(userEntry, agents);
    // Point the @mastra/core/agent import at our stub for evaluation.
    source = source.replace(`'@mastra/core/agent'`, JSON.stringify(coreStub));

    const generated = join(dir, 'wrapper.mjs');
    await writeFile(generated, source);

    const mod = await import(pathToFileURL(generated).href);

    // Re-exports from the user entry are preserved.
    expect(mod.extra).toBe('kept');
    // The wrapper exports the same mastra instance.
    expect(mod.mastra).toBeTruthy();
    // The agent was assembled and registered.
    expect(mod.mastra.registered.weather).toBeTruthy();
    expect(mod.mastra.registered.weather.name).toBe('weather');
    expect(mod.mastra.registered.weather.__entry.tools[0].key).toBe('get_weather');
  });

  it('inlines a packaged skill via createSkill into the assembled entry', async () => {
    const coreStub = join(dir, 'core-agent.mjs');
    await writeFile(
      coreStub,
      `export function assembleAgentFromFsEntry(entry) {
         return { id: entry.name, name: entry.name, __entry: entry };
       }`,
    );
    const skillsStub = join(dir, 'core-skills.mjs');
    await writeFile(skillsStub, `export function createSkill(input) { return { __inline: true, ...input }; }`);

    const userEntry = join(dir, 'index.mjs');
    await writeFile(
      userEntry,
      `const registered = {};
       export const mastra = {
         registered,
         getLogger() { return { warn() {} }; },
         __registerFsAgents(map) { Object.assign(registered, map); },
       };`,
    );

    const agentDir = join(dir, 'agents', 'weather');
    await mkdir(agentDir, { recursive: true });
    await writeFile(join(agentDir, 'config.mjs'), `export default { model: 'm' };`);

    const agents: DiscoveredFsAgent[] = [
      {
        name: 'weather',
        dir: agentDir,
        configPath: join(agentDir, 'config.mjs'),
        instructionsPath: undefined,
        tools: [],
        skills: [
          {
            kind: 'packaged',
            name: 'review',
            description: 'Use when reviewing.',
            instructions: '# Review\nDo it.',
            references: { 'checklist.md': '# Checklist' },
          },
        ],
        subagents: [],
      },
    ];

    let source = await generateFsAgentsModule(userEntry, agents);
    source = source.replace(`'@mastra/core/agent'`, JSON.stringify(coreStub));
    source = source.replace(`'@mastra/core/skills'`, JSON.stringify(skillsStub));

    const generated = join(dir, 'wrapper-skills.mjs');
    await writeFile(generated, source);

    const mod = await import(pathToFileURL(generated).href);

    const skill = mod.mastra.registered.weather.__entry.skills[0];
    expect(skill).toMatchObject({ __inline: true, name: 'review', description: 'Use when reviewing.' });
    expect(skill.instructions).toContain('Do it.');
    expect(skill.references['checklist.md']).toContain('Checklist');
  });

  it('assembles a declared subagent and exposes it under its bare id', async () => {
    // The stub recursively assembles subagents into a `subagents` map keyed by
    // the bare child id, mirroring how real assembly wires `agents`.
    const coreStub = join(dir, 'core-agent.mjs');
    await writeFile(
      coreStub,
      `export function assembleAgentFromFsEntry(entry) {
         const subagents = {};
         for (const child of entry.subagents ?? []) {
           subagents[child.name] = assembleAgentFromFsEntry(child);
         }
         return { id: entry.name, name: entry.name, __entry: entry, subagents };
       }`,
    );

    const userEntry = join(dir, 'index.mjs');
    await writeFile(
      userEntry,
      `const registered = {};
       export const mastra = {
         registered,
         getLogger() { return { warn() {} }; },
         __registerFsAgents(map) { Object.assign(registered, map); },
       };`,
    );

    const parentDir = join(dir, 'agents', 'supervisor');
    const childDir = join(parentDir, 'subagents', 'writer');
    await mkdir(childDir, { recursive: true });
    await writeFile(join(parentDir, 'config.mjs'), `export default { model: 'm' };`);
    await writeFile(join(childDir, 'config.mjs'), `export default { model: 'm', description: 'Writes' };`);

    const agents: DiscoveredFsAgent[] = [
      {
        name: 'supervisor',
        dir: parentDir,
        configPath: join(parentDir, 'config.mjs'),
        instructionsPath: undefined,
        tools: [],
        skills: [],
        subagents: [
          {
            name: 'writer',
            dir: childDir,
            configPath: join(childDir, 'config.mjs'),
            instructionsPath: undefined,
            tools: [],
            skills: [],
            subagents: [],
          },
        ],
      },
    ];

    let source = await generateFsAgentsModule(userEntry, agents);
    source = source.replace(`'@mastra/core/agent'`, JSON.stringify(coreStub));

    const generated = join(dir, 'wrapper-subagent.mjs');
    await writeFile(generated, source);

    const mod = await import(pathToFileURL(generated).href);

    const supervisor = mod.mastra.registered.supervisor;
    expect(supervisor).toBeTruthy();
    // The declared subagent is wired in under its bare id.
    expect(Object.keys(supervisor.subagents)).toEqual(['writer']);
    expect(supervisor.subagents.writer.name).toBe('writer');
    expect(supervisor.subagents.writer.__entry.config.description).toBe('Writes');
  });
});
