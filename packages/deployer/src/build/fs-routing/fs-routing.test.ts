import { mkdir, mkdtemp, rm, writeFile, readFile, symlink, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_FS_SUBAGENT_DEPTH } from '@mastra/core/agent';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateFsAgentsModule } from './codegen';
import { discoverFsAgents, discoverFsSingleton, discoverFsWorkflows } from './discover';
import { mirrorFsAgentWorkspaces } from './mirror';
import { prepareFsAgentsEntry, writeFsAgentsEntry } from './prepare';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fs-routing-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

interface AgentFiles {
  config?: string;
  instructions?: string;
  memory?: string;
  workspace?: string;
  /** Map of relative path under `workspace/` to seed file content. */
  workspaceSeed?: Record<string, string>;
  tools?: Record<string, string>;
  /** Map of relative path under `skills/` to file content. */
  skills?: Record<string, string>;
  /** Declared subagents, written under `subagents/<id>/`. */
  subagents?: Record<string, AgentFiles>;
}

async function writeAgentDir(agentDir: string, files: AgentFiles) {
  await mkdir(agentDir, { recursive: true });
  if (files.config !== undefined) {
    await writeFile(join(agentDir, 'config.ts'), files.config);
  }
  if (files.instructions !== undefined) {
    await writeFile(join(agentDir, 'instructions.md'), files.instructions);
  }
  if (files.memory !== undefined) {
    await writeFile(join(agentDir, 'memory.ts'), files.memory);
  }
  if (files.workspace !== undefined) {
    await writeFile(join(agentDir, 'workspace.ts'), files.workspace);
  }
  if (files.workspaceSeed) {
    for (const [relPath, content] of Object.entries(files.workspaceSeed)) {
      const target = join(agentDir, 'workspace', relPath);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, content);
    }
  }
  if (files.tools) {
    await mkdir(join(agentDir, 'tools'), { recursive: true });
    for (const [basename, content] of Object.entries(files.tools)) {
      await writeFile(join(agentDir, 'tools', basename), content);
    }
  }
  if (files.skills) {
    for (const [relPath, content] of Object.entries(files.skills)) {
      const target = join(agentDir, 'skills', relPath);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, content);
    }
  }
  if (files.subagents) {
    for (const [childName, childFiles] of Object.entries(files.subagents)) {
      await writeAgentDir(join(agentDir, 'subagents', childName), childFiles);
    }
  }
}

async function writeAgent(name: string, files: AgentFiles) {
  await writeAgentDir(join(dir, 'agents', name), files);
}

describe('discoverFsAgents', () => {
  it('returns empty when there is no agents directory', async () => {
    expect(await discoverFsAgents(dir)).toEqual([]);
  });

  it('discovers an agent with config, instructions, and tools', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'Be helpful.',
      tools: {
        'get_weather.ts': `export default {};`,
        'get_forecast.ts': `export default {};`,
      },
    });

    const agents = await discoverFsAgents(dir);
    expect(agents).toHaveLength(1);
    const agent = agents[0]!;
    expect(agent.name).toBe('weather');
    expect(agent.configPath).toMatch(/agents\/weather\/config\.ts$/);
    expect(agent.instructionsPath).toMatch(/agents\/weather\/instructions\.md$/);
    expect(agent.tools.map(t => t.key).sort()).toEqual(['get_forecast', 'get_weather']);
  });

  it('skips directories without config or instructions', async () => {
    await mkdir(join(dir, 'agents', 'not-an-agent'), { recursive: true });
    await writeAgent('real', { instructions: 'hi' });

    const agents = await discoverFsAgents(dir);
    expect(agents.map(a => a.name)).toEqual(['real']);
  });

  it('ignores test files in tools', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      tools: {
        'get_weather.ts': `export default {};`,
        'get_weather.test.ts': `export default {};`,
      },
    });

    const agents = await discoverFsAgents(dir);
    expect(agents[0]!.tools.map(t => t.key)).toEqual(['get_weather']);
  });

  it('returns agents sorted by name', async () => {
    await writeAgent('zebra', { instructions: 'z' });
    await writeAgent('alpha', { instructions: 'a' });

    const agents = await discoverFsAgents(dir);
    expect(agents.map(a => a.name)).toEqual(['alpha', 'zebra']);
  });

  it('discovers a packaged SKILL.md skill with frontmatter and references', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      skills: {
        'review/SKILL.md': `---\nname: review\ndescription: Use when reviewing.\n---\n\n# Review\nDo the review.`,
        'review/references/checklist.md': `# Checklist\n- correctness`,
      },
    });

    const agents = await discoverFsAgents(dir);
    expect(agents[0]!.skills).toHaveLength(1);
    const skill = agents[0]!.skills[0]!;
    expect(skill).toMatchObject({
      kind: 'packaged',
      name: 'review',
      description: 'Use when reviewing.',
    });
    if (skill.kind === 'packaged') {
      expect(skill.instructions).toContain('Do the review.');
      expect(skill.references['checklist.md']).toContain('correctness');
    }
  });

  it('skips symlinked skill references so arbitrary files are not embedded', async () => {
    // A secret outside the agent directory the symlink would otherwise leak.
    const secret = join(dir, 'secret.txt');
    await writeFile(secret, 'TOP SECRET');
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      skills: {
        'review/SKILL.md': `---\nname: review\ndescription: Use when reviewing.\n---\n\n# Review`,
        'review/references/ok.md': `# Ok`,
      },
    });
    await symlink(secret, join(dir, 'agents', 'weather', 'skills', 'review', 'references', 'leak.md'));

    const skill = (await discoverFsAgents(dir))[0]!.skills[0]!;
    if (skill.kind === 'packaged') {
      expect(skill.references['ok.md']).toContain('Ok');
      expect(skill.references['leak.md']).toBeUndefined();
    }
  });

  it('skips symlinked tool modules so arbitrary files are not bundled', async () => {
    // A file outside the agent dir a symlinked tool would otherwise import.
    const secret = join(dir, 'secret.ts');
    await writeFile(secret, `export default { secret: true };`);
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      tools: { 'real.ts': `export default {};` },
    });
    await symlink(secret, join(dir, 'agents', 'weather', 'tools', 'leak.ts'));

    const tools = (await discoverFsAgents(dir))[0]!.tools;
    expect(tools.map(t => t.key)).toEqual(['real']);
  });

  it('skips symlinked skill modules so arbitrary files are not bundled', async () => {
    const secret = join(dir, 'secret-skill.ts');
    await writeFile(secret, `export default {};`);
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      skills: { 'support.ts': `export default {};` },
    });
    await symlink(secret, join(dir, 'agents', 'weather', 'skills', 'leak.ts'));

    const skills = (await discoverFsAgents(dir))[0]!.skills;
    expect(skills).toHaveLength(1);
    const skill = skills[0]!;
    expect(skill.kind).toBe('module');
    if (skill.kind === 'module') {
      expect(skill.path).toMatch(/support\.ts$/);
    }
  });

  it('skips symlinked agent directories so discovery cannot escape the project tree', async () => {
    // A real agent outside `agents/` that a symlinked entry would point at.
    const outside = join(dir, 'outside-agent');
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, 'instructions.md'), 'leaked');
    await writeAgent('real', { instructions: 'hi' });
    await mkdir(join(dir, 'agents'), { recursive: true });
    await symlink(outside, join(dir, 'agents', 'evil'));

    const agents = await discoverFsAgents(dir);
    expect(agents.map(a => a.name)).toEqual(['real']);
  });

  it('skips symlinked subagent directories so discovery cannot escape the project tree', async () => {
    const outside = join(dir, 'outside-subagent');
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, 'instructions.md'), 'leaked');
    await writeAgent('parent', {
      instructions: 'hi',
      subagents: { real: { config: `export default { description: 'd' };`, instructions: 'child' } },
    });
    await symlink(outside, join(dir, 'agents', 'parent', 'subagents', 'evil'));

    const parent = (await discoverFsAgents(dir))[0]!;
    expect(parent.subagents.map(s => s.name)).toEqual(['real']);
  });

  it('skips a symlinked instructions.md so its contents are not inlined', async () => {
    const secret = join(dir, 'secret.md');
    await writeFile(secret, 'top secret');
    await writeAgent('weather', { config: `export default { model: 'openai/gpt-4o' };` });
    await symlink(secret, join(dir, 'agents', 'weather', 'instructions.md'));

    const agent = (await discoverFsAgents(dir))[0]!;
    expect(agent.instructionsPath).toBeUndefined();
  });

  it('skips a symlinked config.ts so it is not imported into the bundle', async () => {
    const secret = join(dir, 'secret-config.ts');
    await writeFile(secret, `export default { model: 'openai/gpt-4o' };`);
    await writeAgent('weather', { instructions: 'hi' });
    await symlink(secret, join(dir, 'agents', 'weather', 'config.ts'));

    const agent = (await discoverFsAgents(dir))[0]!;
    expect(agent.configPath).toBeUndefined();
  });

  it('skips a symlinked memory.ts so it is not imported into the bundle', async () => {
    const secret = join(dir, 'secret-memory.ts');
    await writeFile(secret, `export default {};`);
    await writeAgent('weather', { config: `export default { model: 'openai/gpt-4o' };`, instructions: 'hi' });
    await symlink(secret, join(dir, 'agents', 'weather', 'memory.ts'));

    const agent = (await discoverFsAgents(dir))[0]!;
    expect(agent.memoryPath).toBeUndefined();
  });

  it('discovers a flat markdown skill, defaulting name to the filename', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      skills: { 'faq.md': `---\ndescription: Answer common questions.\n---\n\n# FAQ\nAnswer questions.` },
    });

    const skill = (await discoverFsAgents(dir))[0]!.skills[0]!;
    expect(skill).toMatchObject({ kind: 'packaged', name: 'faq', description: 'Answer common questions.' });
  });

  it('throws when a flat markdown skill is missing a description', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      skills: { 'faq.md': `# FAQ\nAnswer questions.` },
    });

    await expect(discoverFsAgents(dir)).rejects.toThrow(/missing a required "description"/);
  });

  it('discovers a createSkill module as a module skill', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      skills: { 'support.ts': `export default {};` },
    });

    const skill = (await discoverFsAgents(dir))[0]!.skills[0]!;
    expect(skill.kind).toBe('module');
    if (skill.kind === 'module') {
      expect(skill.path).toMatch(/agents\/weather\/skills\/support\.ts$/);
    }
  });

  it('ignores test files in skills', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      skills: {
        'support.ts': `export default {};`,
        'support.test.ts': `export default {};`,
      },
    });

    expect((await discoverFsAgents(dir))[0]!.skills).toHaveLength(1);
  });

  it('exposes the agent dir and discovers workspace.ts when present', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      workspace: `export default {};`,
    });

    const agent = (await discoverFsAgents(dir))[0]!;
    expect(agent.dir).toMatch(/agents\/weather$/);
    expect(agent.workspacePath).toMatch(/agents\/weather\/workspace\.ts$/);
  });

  it('leaves workspacePath undefined when there is no workspace file', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });

    expect((await discoverFsAgents(dir))[0]!.workspacePath).toBeUndefined();
  });

  it('discovers memory.ts when present', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      memory: `export default {};`,
    });

    expect((await discoverFsAgents(dir))[0]!.memoryPath).toMatch(/agents\/weather\/memory\.ts$/);
  });

  it('leaves memoryPath undefined when there is no memory file', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });

    expect((await discoverFsAgents(dir))[0]!.memoryPath).toBeUndefined();
  });

  it('discovers a subagent memory.ts', async () => {
    await writeAgent('supervisor', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      subagents: {
        worker: {
          config: `export default { model: 'openai/gpt-4o', description: 'worker' };`,
          instructions: 'hi',
          memory: `export default {};`,
        },
      },
    });

    const agent = (await discoverFsAgents(dir))[0]!;
    expect(agent.subagents[0]!.memoryPath).toMatch(/subagents\/worker\/memory\.ts$/);
  });

  it('discovers an authored workspace/ seed directory', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      workspaceSeed: { 'README.md': '# Seed', 'data/notes.txt': 'note' },
    });

    const agent = (await discoverFsAgents(dir))[0]!;
    expect(agent.workspaceSeedDir).toMatch(/agents\/weather\/workspace$/);
  });

  it('leaves workspaceSeedDir undefined when there is no workspace/ dir', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });

    expect((await discoverFsAgents(dir))[0]!.workspaceSeedDir).toBeUndefined();
  });

  it('does not treat a workspace.ts file as a seed directory', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      workspace: `export default {};`,
    });

    const agent = (await discoverFsAgents(dir))[0]!;
    expect(agent.workspacePath).toBeDefined();
    expect(agent.workspaceSeedDir).toBeUndefined();
  });
});

describe('generateFsAgentsModule', () => {
  it('imports the user entry and assembles each agent', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'Be a weather assistant.',
      tools: { 'get_weather.ts': `export default {};` },
    });
    const agents = await discoverFsAgents(dir);

    const source = await generateFsAgentsModule('/project/src/mastra/index.ts', agents);

    expect(source).toContain(`import { assembleAgentFromFsEntry } from '@mastra/core/agent';`);
    expect(source).toContain(`import * as __userEntry from "/project/src/mastra/index.ts";`);
    expect(source).toContain(`export * from "/project/src/mastra/index.ts";`);
    // instructions.md content is inlined.
    expect(source).toContain(JSON.stringify('Be a weather assistant.'));
    // tool key preserved.
    expect(source).toContain(`key: "get_weather"`);
    expect(source).toContain(`mastra.__registerFsAgents`);
    expect(source).toContain(`export const mastra = __mastra;`);
  });

  it('omits instructionsMd when there is no markdown file', async () => {
    await writeAgent('coder', {
      config: `export default { model: 'openai/gpt-4o', instructions: 'code' };`,
    });
    const agents = await discoverFsAgents(dir);

    const source = await generateFsAgentsModule('/project/index.ts', agents);
    expect(source).not.toContain('instructionsMd:');
  });

  it('inlines packaged skills via createSkill and imports module skills', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      skills: {
        'review/SKILL.md': `---\nname: review\ndescription: Use when reviewing.\n---\n\n# Review\nDo it.`,
        'review/references/checklist.md': `# Checklist`,
        'support.ts': `export default {};`,
      },
    });
    const agents = await discoverFsAgents(dir);

    const source = await generateFsAgentsModule('/project/index.ts', agents);
    expect(source).toContain(`import { createSkill as __createSkill } from '@mastra/core/skills';`);
    expect(source).toContain(`__createSkill({`);
    expect(source).toContain(`name: "review"`);
    expect(source).toContain(`references: {`);
    expect(source).toContain(`"checklist.md"`);
    // module skill imported and threaded into skills array
    expect(source).toMatch(/import skill_\d+_\w+ from "[^"]*support\.ts";/);
    expect(source).toContain(`skills: [`);
  });

  it('does not import createSkill when there are no packaged skills', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      skills: { 'support.ts': `export default {};` },
    });
    const agents = await discoverFsAgents(dir);

    const source = await generateFsAgentsModule('/project/index.ts', agents);
    expect(source).not.toContain('__createSkill');
  });

  it('always emits a defaultWorkspaceBasePath for each agent (default-on parity)', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    const agents = await discoverFsAgents(dir);

    const source = await generateFsAgentsModule('/project/index.ts', agents);
    // Base path is resolved at runtime relative to the bundled module so it
    // points at `<bundle>/workspace/<name>` wherever the bundle is deployed.
    expect(source).toContain('defaultWorkspaceBasePath: __workspaceBasePath("weather")');
    expect(source).toContain('const __bundleDir = __dirname(__fileURLToPath(import.meta.url));');
    expect(source).not.toContain('workspace:');
  });

  it('imports workspace.ts and threads it into the entry when present', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      workspace: `export default {};`,
    });
    const agents = await discoverFsAgents(dir);

    const source = await generateFsAgentsModule('/project/index.ts', agents);
    expect(source).toMatch(/import workspace_\d+_\w+ from "[^"]*workspace\.ts";/);
    expect(source).toMatch(/workspace: workspace_\d+_\w+/);
    expect(source).toContain('defaultWorkspaceBasePath:');
  });

  it('imports memory.ts and threads it into the entry when present', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      memory: `export default {};`,
    });
    const agents = await discoverFsAgents(dir);

    const source = await generateFsAgentsModule('/project/index.ts', agents);
    expect(source).toMatch(/import memory_\w+ from "[^"]*memory\.ts";/);
    expect(source).toMatch(/memory: memory_\w+/);
  });

  it('imports a subagent memory.ts and threads it into the nested entry', async () => {
    await writeAgent('supervisor', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      subagents: {
        worker: {
          config: `export default { model: 'openai/gpt-4o', description: 'worker' };`,
          instructions: 'hi',
          memory: `export default {};`,
        },
      },
    });
    const agents = await discoverFsAgents(dir);

    const source = await generateFsAgentsModule('/project/index.ts', agents);
    expect(source).toMatch(/import memory_\w+ from "[^"]*subagents\/worker\/memory\.ts";/);
    expect(source).toMatch(/memory: memory_\w+/);
  });
});

describe('prepareFsAgentsEntry', () => {
  it('returns the original entry unchanged when there are no fs agents', async () => {
    const out = join(dir, '.mastra');
    const result = await prepareFsAgentsEntry(dir, '/project/index.ts', out);
    expect(result).toEqual({
      entryFile: '/project/index.ts',
      standalone: false,
      toolPaths: [],
      agentCount: 0,
      workflowCount: 0,
      hasStorage: false,
      hasObservability: false,
      hasServer: false,
      hasStudio: false,
    });
  });

  it('returns a wrapper entry path, tool paths, and deferred source without writing', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      tools: { 'get_weather.ts': `export default {};` },
    });
    const out = join(dir, '.mastra');

    const result = await prepareFsAgentsEntry(dir, join(dir, 'index.ts'), out);
    expect(result.agentCount).toBe(1);
    expect(result.entryFile).toMatch(/\.mastra-fs-agents-entry\.mjs$/);
    expect(result.toolPaths.some(p => p.includes('agents/*/tools'))).toBe(true);
    expect(result.moduleSource).toBeTruthy();

    // The wrapper must NOT be written by prepare(): the bundler empties the
    // output dir between prepare() and the actual write.
    await expect(access(result.entryFile)).rejects.toThrow();
  });

  it('writeFsAgentsEntry writes the wrapper after the output dir is emptied', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    const out = join(dir, '.mastra');

    const result = await prepareFsAgentsEntry(dir, join(dir, 'index.ts'), out);

    // Simulate bundler.prepare() emptying the output directory.
    await rm(out, { recursive: true, force: true });

    await writeFsAgentsEntry(result);
    const written = await readFile(result.entryFile, 'utf-8');
    expect(written).toBe(result.moduleSource);
  });

  it('writeFsAgentsEntry is a no-op when there are no fs agents', async () => {
    const out = join(dir, '.mastra');
    const result = await prepareFsAgentsEntry(dir, '/project/index.ts', out);
    await expect(writeFsAgentsEntry(result)).resolves.toBeUndefined();
  });
});

describe('standalone auto-construction (no index.ts)', () => {
  it('auto-constructs a Mastra instance when entryFile is undefined and primitives exist', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    const out = join(dir, '.mastra');

    const result = await prepareFsAgentsEntry(dir, undefined, out);
    expect(result.standalone).toBe(true);
    expect(result.agentCount).toBe(1);
    expect(result.moduleSource).toBeTruthy();
    expect(result.moduleSource).toContain(`import { Mastra } from '@mastra/core'`);
    expect(result.moduleSource).toContain(`new Mastra({})`);
    expect(result.moduleSource).not.toContain('__userEntry');
  });

  it('throws when no index.ts and no fs primitives exist', async () => {
    const out = join(dir, '.mastra');
    await expect(prepareFsAgentsEntry(dir, undefined, out)).rejects.toThrow(
      /No index\.ts and no file-based primitives/,
    );
  });

  it('standalone module registers discovered singletons', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    await writeFile(join(dir, 'storage.ts'), `export default {};`);
    const out = join(dir, '.mastra');

    const result = await prepareFsAgentsEntry(dir, undefined, out);
    expect(result.standalone).toBe(true);
    expect(result.hasStorage).toBe(true);
    expect(result.moduleSource).toContain('__registerFsStorage');
    expect(result.moduleSource).toContain(`new Mastra({})`);
  });

  it('standalone module includes workflow registration', async () => {
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'pipeline.ts'), `export default {};`);
    const out = join(dir, '.mastra');

    const result = await prepareFsAgentsEntry(dir, undefined, out);
    expect(result.standalone).toBe(true);
    expect(result.workflowCount).toBe(1);
    expect(result.moduleSource).toContain('__registerFsWorkflows');
  });
});

describe('mirrorFsAgentWorkspaces', () => {
  it('mirrors authored workspace/ seeds into <bundle>/workspace/<name>', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      workspaceSeed: { 'README.md': '# Seed', 'data/notes.txt': 'note' },
    });
    const bundleDir = join(dir, 'output');

    const mirrored = await mirrorFsAgentWorkspaces(dir, bundleDir);

    expect(mirrored).toEqual(['weather']);
    expect(await readFile(join(bundleDir, 'workspace', 'weather', 'README.md'), 'utf-8')).toBe('# Seed');
    expect(await readFile(join(bundleDir, 'workspace', 'weather', 'data', 'notes.txt'), 'utf-8')).toBe('note');
  });

  it('does not mirror symlinked workspace seeds (no sandbox escape)', async () => {
    const secret = join(dir, 'secret.txt');
    await writeFile(secret, 'TOP SECRET');
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      workspaceSeed: { 'README.md': '# Seed' },
    });
    await symlink(secret, join(dir, 'agents', 'weather', 'workspace', 'leak.txt'));
    const bundleDir = join(dir, 'output');

    await mirrorFsAgentWorkspaces(dir, bundleDir);

    expect(await readFile(join(bundleDir, 'workspace', 'weather', 'README.md'), 'utf-8')).toBe('# Seed');
    await expect(access(join(bundleDir, 'workspace', 'weather', 'leak.txt'))).rejects.toThrow();
  });

  it('mirrors nothing when no agent has a workspace/ seed dir', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    const bundleDir = join(dir, 'output');

    expect(await mirrorFsAgentWorkspaces(dir, bundleDir)).toEqual([]);
  });
});

describe('discoverFsWorkflows', () => {
  it('returns empty when there is no workflows directory', async () => {
    expect(await discoverFsWorkflows(dir)).toEqual([]);
  });

  it('discovers workflow modules as key/path pairs', async () => {
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'data-pipeline.ts'), `export default {};`);
    await writeFile(join(dir, 'workflows', 'onboarding.ts'), `export default {};`);

    const workflows = await discoverFsWorkflows(dir);
    expect(workflows).toHaveLength(2);
    expect(workflows.map(w => w.key)).toEqual(['data-pipeline', 'onboarding']);
    expect(workflows[0]!.path).toMatch(/workflows\/data-pipeline\.ts$/);
    expect(workflows[1]!.path).toMatch(/workflows\/onboarding\.ts$/);
  });

  it('ignores test files in workflows', async () => {
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'pipeline.ts'), `export default {};`);
    await writeFile(join(dir, 'workflows', 'pipeline.test.ts'), `test('it works', () => {});`);
    await writeFile(join(dir, 'workflows', 'pipeline.spec.ts'), `test('it works', () => {});`);

    const workflows = await discoverFsWorkflows(dir);
    expect(workflows.map(w => w.key)).toEqual(['pipeline']);
  });

  it('skips symlinked workflow files', async () => {
    const secret = join(dir, 'secret-workflow.ts');
    await writeFile(secret, `export default {};`);
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'real.ts'), `export default {};`);
    await symlink(secret, join(dir, 'workflows', 'leak.ts'));

    const workflows = await discoverFsWorkflows(dir);
    expect(workflows.map(w => w.key)).toEqual(['real']);
  });

  it('skips directories inside workflows/', async () => {
    // Use a .ts extension so it passes the extension filter and reaches isDirectory()
    await mkdir(join(dir, 'workflows', 'not-a-workflow.ts'), { recursive: true });
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'real.ts'), `export default {};`);

    const workflows = await discoverFsWorkflows(dir);
    expect(workflows.map(w => w.key)).toEqual(['real']);
  });

  it('returns workflows sorted by key', async () => {
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'zebra.ts'), `export default {};`);
    await writeFile(join(dir, 'workflows', 'alpha.ts'), `export default {};`);

    const workflows = await discoverFsWorkflows(dir);
    expect(workflows.map(w => w.key)).toEqual(['alpha', 'zebra']);
  });

  it('ignores non-ts/js files', async () => {
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'real.ts'), `export default {};`);
    await writeFile(join(dir, 'workflows', 'readme.md'), `# docs`);
    await writeFile(join(dir, 'workflows', 'notes.txt'), `notes`);

    const workflows = await discoverFsWorkflows(dir);
    expect(workflows.map(w => w.key)).toEqual(['real']);
  });

  it('skips workflow files without export default (named exports only)', async () => {
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'fs-workflow.ts'), `export default createWorkflow({});`);
    await writeFile(
      join(dir, 'workflows', 'manual-workflow.ts'),
      `export const weatherWorkflow = createWorkflow({});\nexport { weatherWorkflow };`,
    );

    const workflows = await discoverFsWorkflows(dir);
    expect(workflows.map(w => w.key)).toEqual(['fs-workflow']);
  });
});

describe('generateFsAgentsModule with workflows', () => {
  it('includes workflow imports and registration when workflows are provided', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    const agents = await discoverFsAgents(dir);

    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'pipeline.ts'), `export default {};`);
    const workflows = await discoverFsWorkflows(dir);

    const source = await generateFsAgentsModule('/project/src/mastra/index.ts', agents, { workflows });

    expect(source).toContain(`import workflow_0_pipeline from`);
    expect(source).toContain(`__fsWorkflows["pipeline"] = workflow_0_pipeline;`);
    expect(source).toContain(`mastra.__registerFsWorkflows`);
  });

  it('omits workflow registration when no workflows are provided', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    const agents = await discoverFsAgents(dir);

    const source = await generateFsAgentsModule('/project/src/mastra/index.ts', agents);

    expect(source).not.toContain('__fsWorkflows');
    expect(source).not.toContain('__registerFsWorkflows');
  });

  it('generates a valid wrapper when only workflows exist (no agents)', async () => {
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'onboarding.ts'), `export default {};`);
    const workflows = await discoverFsWorkflows(dir);

    const source = await generateFsAgentsModule('/project/src/mastra/index.ts', [], { workflows });

    expect(source).toContain(`import workflow_0_onboarding from`);
    expect(source).toContain(`__registerFsWorkflows`);
    expect(source).toContain(`export const mastra = __mastra;`);
    // Agent registration still present but with empty entries
    expect(source).toContain('__registerFsAgents');
  });

  it('handles multiple workflows with sanitized identifiers', async () => {
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'data-pipeline.ts'), `export default {};`);
    await writeFile(join(dir, 'workflows', 'user-onboarding.ts'), `export default {};`);
    const workflows = await discoverFsWorkflows(dir);

    const source = await generateFsAgentsModule('/project/src/mastra/index.ts', [], { workflows });

    expect(source).toContain(`import workflow_0_data_pipeline from`);
    expect(source).toContain(`import workflow_1_user_onboarding from`);
    expect(source).toContain(`__fsWorkflows["data-pipeline"] = workflow_0_data_pipeline;`);
    expect(source).toContain(`__fsWorkflows["user-onboarding"] = workflow_1_user_onboarding;`);
  });
});

describe('prepareFsAgentsEntry with workflows', () => {
  it('generates a wrapper when only workflows exist (no agents)', async () => {
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'pipeline.ts'), `export default {};`);
    const out = join(dir, '.mastra');

    const result = await prepareFsAgentsEntry(dir, join(dir, 'index.ts'), out);
    expect(result.agentCount).toBe(0);
    expect(result.workflowCount).toBe(1);
    expect(result.entryFile).toMatch(/\.mastra-fs-agents-entry\.mjs$/);
    expect(result.moduleSource).toBeTruthy();
    expect(result.toolPaths).toEqual([]);
  });

  it('discovers both agents and workflows together', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      tools: { 'get_weather.ts': `export default {};` },
    });
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'pipeline.ts'), `export default {};`);
    const out = join(dir, '.mastra');

    const result = await prepareFsAgentsEntry(dir, join(dir, 'index.ts'), out);
    expect(result.agentCount).toBe(1);
    expect(result.workflowCount).toBe(1);
    expect(result.toolPaths.some(p => p.includes('agents/*/tools'))).toBe(true);
    expect(result.moduleSource).toContain('__registerFsWorkflows');
  });
});

describe('discoverFsSingleton', () => {
  it('returns undefined when no singleton file exists', async () => {
    expect(await discoverFsSingleton(dir, 'storage')).toBeUndefined();
  });

  it('discovers a .ts singleton file', async () => {
    await writeFile(join(dir, 'storage.ts'), `export default {};`);

    const result = await discoverFsSingleton(dir, 'storage');
    expect(result).toBeTruthy();
    expect(result!.path).toMatch(/storage\.ts$/);
  });

  it('discovers a .js singleton file', async () => {
    await writeFile(join(dir, 'storage.js'), `export default {};`);

    const result = await discoverFsSingleton(dir, 'storage');
    expect(result).toBeTruthy();
    expect(result!.path).toMatch(/storage\.js$/);
  });

  it('prefers .ts over .js when both exist', async () => {
    await writeFile(join(dir, 'storage.ts'), `export default {};`);
    await writeFile(join(dir, 'storage.js'), `export default {};`);

    const result = await discoverFsSingleton(dir, 'storage');
    expect(result!.path).toMatch(/storage\.ts$/);
  });

  it('skips symlinked singleton files', async () => {
    const secret = join(dir, 'secret-storage.ts');
    await writeFile(secret, `export default {};`);
    await symlink(secret, join(dir, 'storage.ts'));

    const result = await discoverFsSingleton(dir, 'storage');
    expect(result).toBeUndefined();
  });

  it('works with different singleton names', async () => {
    await writeFile(join(dir, 'observability.ts'), `export default {};`);

    const result = await discoverFsSingleton(dir, 'observability');
    expect(result).toBeTruthy();
    expect(result!.path).toMatch(/observability\.ts$/);
  });

  it('skips singleton files without export default (named exports only)', async () => {
    await writeFile(
      join(dir, 'storage.ts'),
      `export const storage = new LibSQLStore({});\nexport async function initStorage() {}`,
    );

    expect(await discoverFsSingleton(dir, 'storage')).toBeUndefined();
  });

  it('rejects names containing path traversal or separators', async () => {
    await expect(discoverFsSingleton(dir, '../secret')).rejects.toThrow(/bare identifier/);
    await expect(discoverFsSingleton(dir, 'foo/bar')).rejects.toThrow(/bare identifier/);
  });
});

describe('generateFsAgentsModule with storage', () => {
  it('includes storage import and registration when storage is provided', async () => {
    const source = await generateFsAgentsModule('/project/src/mastra/index.ts', [], {
      storage: { path: '/project/src/mastra/storage.ts' },
    });

    expect(source).toContain(`import __fsStorage from "/project/src/mastra/storage.ts";`);
    expect(source).toContain(`mastra.__registerFsStorage`);
  });

  it('registers storage before agents so fs primitives bind to the fs store', async () => {
    const source = await generateFsAgentsModule('/project/src/mastra/index.ts', [], {
      storage: { path: '/project/src/mastra/storage.ts' },
    });

    expect(source.indexOf('__registerFsStorage')).toBeLessThan(source.indexOf('__registerFsAgents'));
  });

  it('omits storage registration when no storage is provided', async () => {
    const source = await generateFsAgentsModule('/project/src/mastra/index.ts', []);

    expect(source).not.toContain('__fsStorage');
    expect(source).not.toContain('__registerFsStorage');
  });
});

describe('prepareFsAgentsEntry with storage', () => {
  it('generates a wrapper when only storage.ts exists (no agents or workflows)', async () => {
    await writeFile(join(dir, 'storage.ts'), `export default {};`);
    const out = join(dir, '.mastra');

    const result = await prepareFsAgentsEntry(dir, join(dir, 'index.ts'), out);
    expect(result.agentCount).toBe(0);
    expect(result.workflowCount).toBe(0);
    expect(result.hasStorage).toBe(true);
    expect(result.entryFile).toMatch(/\.mastra-fs-agents-entry\.mjs$/);
    expect(result.moduleSource).toBeTruthy();
    expect(result.moduleSource).toContain('__registerFsStorage');
  });

  it('discovers agents, workflows, and storage together', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'pipeline.ts'), `export default {};`);
    await writeFile(join(dir, 'storage.ts'), `export default {};`);
    const out = join(dir, '.mastra');

    const result = await prepareFsAgentsEntry(dir, join(dir, 'index.ts'), out);
    expect(result.agentCount).toBe(1);
    expect(result.workflowCount).toBe(1);
    expect(result.hasStorage).toBe(true);
    expect(result.moduleSource).toContain('__registerFsWorkflows');
    expect(result.moduleSource).toContain('__registerFsStorage');
  });
});

describe('generateFsAgentsModule with observability', () => {
  it('includes observability import and registration when provided', async () => {
    const source = await generateFsAgentsModule('/project/index.ts', [], {
      observability: { path: '/project/src/mastra/observability.ts' },
    });
    expect(source).toContain(`import __fsObservability from "/project/src/mastra/observability.ts"`);
    expect(source).toContain('__registerFsObservability(__fsObservability)');
  });

  it('omits observability when not provided', async () => {
    const source = await generateFsAgentsModule('/project/index.ts', []);
    expect(source).not.toContain('__fsObservability');
    expect(source).not.toContain('__registerFsObservability');
  });
});

describe('prepareFsAgentsEntry with observability', () => {
  it('generates a wrapper entry when only observability.ts exists (no agents)', async () => {
    await writeFile(join(dir, 'observability.ts'), `export default {};`);
    const out = join(dir, '.mastra');
    const result = await prepareFsAgentsEntry(dir, join(dir, 'index.ts'), out);
    expect(result.hasObservability).toBe(true);
    expect(result.agentCount).toBe(0);
    expect(result.moduleSource).toContain('__registerFsObservability');
  });

  it('discovers observability alongside agents, workflows, and storage', async () => {
    await writeAgent('assistant', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'pipeline.ts'), `export default {};`);
    await writeFile(join(dir, 'storage.ts'), `export default {};`);
    await writeFile(join(dir, 'observability.ts'), `export default {};`);
    const out = join(dir, '.mastra');

    const result = await prepareFsAgentsEntry(dir, join(dir, 'index.ts'), out);
    expect(result.agentCount).toBe(1);
    expect(result.workflowCount).toBe(1);
    expect(result.hasStorage).toBe(true);
    expect(result.hasObservability).toBe(true);
    expect(result.moduleSource).toContain('__registerFsWorkflows');
    expect(result.moduleSource).toContain('__registerFsStorage');
    expect(result.moduleSource).toContain('__registerFsObservability');
  });
});

describe('generateFsAgentsModule with server', () => {
  it('includes server import and registration when provided', async () => {
    const source = await generateFsAgentsModule('/project/index.ts', [], {
      server: { path: '/project/src/mastra/server.ts' },
    });
    expect(source).toContain(`import __fsServer from "/project/src/mastra/server.ts"`);
    expect(source).toContain('__registerFsServer(__fsServer)');
  });

  it('omits server when not provided', async () => {
    const source = await generateFsAgentsModule('/project/index.ts', []);
    expect(source).not.toContain('__fsServer');
    expect(source).not.toContain('__registerFsServer');
  });
});

describe('prepareFsAgentsEntry with server', () => {
  it('generates a wrapper entry when only server.ts exists (no agents)', async () => {
    await writeFile(join(dir, 'server.ts'), `export default {};`);
    const out = join(dir, '.mastra');
    const result = await prepareFsAgentsEntry(dir, join(dir, 'index.ts'), out);
    expect(result.hasServer).toBe(true);
    expect(result.agentCount).toBe(0);
    expect(result.moduleSource).toContain('__registerFsServer');
  });

  it('discovers server alongside all other primitives', async () => {
    await writeAgent('assistant', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'pipeline.ts'), `export default {};`);
    await writeFile(join(dir, 'storage.ts'), `export default {};`);
    await writeFile(join(dir, 'observability.ts'), `export default {};`);
    await writeFile(join(dir, 'server.ts'), `export default {};`);
    const out = join(dir, '.mastra');

    const result = await prepareFsAgentsEntry(dir, join(dir, 'index.ts'), out);
    expect(result.agentCount).toBe(1);
    expect(result.workflowCount).toBe(1);
    expect(result.hasStorage).toBe(true);
    expect(result.hasObservability).toBe(true);
    expect(result.hasServer).toBe(true);
    expect(result.moduleSource).toContain('__registerFsWorkflows');
    expect(result.moduleSource).toContain('__registerFsStorage');
    expect(result.moduleSource).toContain('__registerFsObservability');
    expect(result.moduleSource).toContain('__registerFsServer');
  });
});

describe('generateFsAgentsModule with studio', () => {
  it('includes studio import and registration when provided', async () => {
    const source = await generateFsAgentsModule('/project/index.ts', [], {
      studio: { path: '/project/src/mastra/studio.ts' },
    });
    expect(source).toContain(`import __fsStudio from "/project/src/mastra/studio.ts"`);
    expect(source).toContain('__registerFsStudio(__fsStudio)');
  });

  it('omits studio when not provided', async () => {
    const source = await generateFsAgentsModule('/project/index.ts', []);
    expect(source).not.toContain('__fsStudio');
    expect(source).not.toContain('__registerFsStudio');
  });
});

describe('prepareFsAgentsEntry with studio', () => {
  it('generates a wrapper entry when only studio.ts exists (no agents)', async () => {
    await writeFile(join(dir, 'studio.ts'), `export default {};`);
    const out = join(dir, '.mastra');
    const result = await prepareFsAgentsEntry(dir, join(dir, 'index.ts'), out);
    expect(result.hasStudio).toBe(true);
    expect(result.agentCount).toBe(0);
    expect(result.moduleSource).toContain('__registerFsStudio');
  });

  it('discovers studio alongside all other primitives', async () => {
    await writeAgent('assistant', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    await mkdir(join(dir, 'workflows'), { recursive: true });
    await writeFile(join(dir, 'workflows', 'pipeline.ts'), `export default {};`);
    await writeFile(join(dir, 'storage.ts'), `export default {};`);
    await writeFile(join(dir, 'observability.ts'), `export default {};`);
    await writeFile(join(dir, 'studio.ts'), `export default {};`);
    const out = join(dir, '.mastra');

    const result = await prepareFsAgentsEntry(dir, join(dir, 'index.ts'), out);
    expect(result.agentCount).toBe(1);
    expect(result.workflowCount).toBe(1);
    expect(result.hasStorage).toBe(true);
    expect(result.hasObservability).toBe(true);
    expect(result.hasStudio).toBe(true);
    expect(result.moduleSource).toContain('__registerFsWorkflows');
    expect(result.moduleSource).toContain('__registerFsStorage');
    expect(result.moduleSource).toContain('__registerFsObservability');
    expect(result.moduleSource).toContain('__registerFsStudio');
  });
});
describe('subagents', () => {
  it('discovers subagents under subagents/', async () => {
    await writeAgent('supervisor', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'Delegate.',
      subagents: {
        researcher: {
          config: `export default { model: 'openai/gpt-4o', description: 'Researches' };`,
          instructions: 'Research.',
          tools: { 'search.ts': `export default {};` },
        },
        writer: {
          config: `export default { model: 'openai/gpt-4o', description: 'Writes' };`,
          instructions: 'Write.',
        },
      },
    });

    const agents = await discoverFsAgents(dir);
    expect(agents).toHaveLength(1);
    const parent = agents[0]!;
    expect(parent.subagents.map(s => s.name)).toEqual(['researcher', 'writer']);
    const researcher = parent.subagents.find(s => s.name === 'researcher')!;
    expect(researcher.tools.map(t => t.key)).toEqual(['search']);
    expect(researcher.instructionsPath).toMatch(/supervisor\/subagents\/researcher\/instructions\.md$/);
  });

  it('skips subagent directories without config or instructions', async () => {
    await writeAgent('supervisor', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    // A stray subagents/ dir with no agent files.
    await mkdir(join(dir, 'agents', 'supervisor', 'subagents', 'not-an-agent'), { recursive: true });

    const parent = (await discoverFsAgents(dir))[0]!;
    expect(parent.subagents).toEqual([]);
  });

  it('discovers nested subagents recursively', async () => {
    await writeAgent('supervisor', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      subagents: {
        researcher: {
          config: `export default { model: 'openai/gpt-4o', description: 'Researches' };`,
          instructions: 'r',
          subagents: {
            helper: {
              config: `export default { model: 'openai/gpt-4o', description: 'Helps' };`,
              instructions: 'h',
            },
          },
        },
      },
    });
    const warnings: string[] = [];

    const parent = (await discoverFsAgents(dir, m => warnings.push(m)))[0]!;
    const researcher = parent.subagents[0]!;
    expect(researcher.subagents.map(s => s.name)).toEqual(['helper']);
    expect(researcher.subagents[0]!.subagents).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it(`ignores subagents nested deeper than ${MAX_FS_SUBAGENT_DEPTH} levels with a warning`, async () => {
    // Build a chain one level deeper than the cap: level1..level{MAX+1}.
    let files: AgentFiles = {
      config: `export default { model: 'openai/gpt-4o', description: 'Too deep' };`,
      instructions: 'too deep',
    };
    for (let depth = MAX_FS_SUBAGENT_DEPTH; depth >= 1; depth--) {
      files = {
        config: `export default { model: 'openai/gpt-4o', description: 'Level ${depth}' };`,
        instructions: `level ${depth}`,
        subagents: { [`level${depth + 1}`]: files },
      };
    }
    await writeAgent('supervisor', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      subagents: { level1: files },
    });
    const warnings: string[] = [];

    const parent = (await discoverFsAgents(dir, m => warnings.push(m)))[0]!;
    // Walk down the chain: every level up to the cap is present.
    let current = parent;
    for (let depth = 1; depth <= MAX_FS_SUBAGENT_DEPTH; depth++) {
      expect(current.subagents.map(s => s.name)).toEqual([`level${depth}`]);
      current = current.subagents[0]!;
    }
    // The level past the cap was dropped with a warning.
    expect(current.subagents).toEqual([]);
    expect(warnings.some(w => new RegExp(`nest ${MAX_FS_SUBAGENT_DEPTH} levels`).test(w))).toBe(true);
  });

  it('emits nested assembleAgentFromFsEntry entries for subagents with inlined instructions', async () => {
    await writeAgent('supervisor', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'Delegate.',
      subagents: {
        writer: {
          config: `export default { model: 'openai/gpt-4o', description: 'Writes' };`,
          instructions: 'You are the writer subagent.',
          tools: { 'draft.ts': `export default {};` },
          subagents: {
            editor: {
              config: `export default { model: 'openai/gpt-4o', description: 'Edits' };`,
              instructions: 'You are the editor subagent.',
            },
          },
        },
      },
    });
    const agents = await discoverFsAgents(dir);

    const source = await generateFsAgentsModule('/project/index.ts', agents);
    // Parent carries a subagents: [...] field.
    expect(source).toContain('subagents: [');
    // Child instructions are inlined.
    expect(source).toContain(JSON.stringify('You are the writer subagent.'));
    // Child name preserved as the bare delegation key.
    expect(source).toContain('name: "writer"');
    // Subagent workspace base path nests under <parent>/<child>.
    expect(source).toContain('defaultWorkspaceBasePath: __workspaceBasePath("supervisor/writer")');
    // Nested subagents are emitted recursively with <parent>/<child>/<grandchild> workspace paths.
    expect(source).toContain('name: "editor"');
    expect(source).toContain(JSON.stringify('You are the editor subagent.'));
    expect(source).toContain('defaultWorkspaceBasePath: __workspaceBasePath("supervisor/writer/editor")');
    // Generated identifiers are unique across parent/child/grandchild.
    expect(source).toMatch(/import config_0_supervisor from /);
    expect(source).toMatch(/import config_0_0_writer from /);
    expect(source).toMatch(/import config_0_0_0_editor from /);
  });

  it('mirrors subagent workspace seeds to <bundle>/workspace/<parent>/<child>', async () => {
    await writeAgent('supervisor', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      workspaceSeed: { 'parent.txt': 'p' },
      subagents: {
        writer: {
          config: `export default { model: 'openai/gpt-4o', description: 'Writes' };`,
          instructions: 'w',
          workspaceSeed: { 'child.txt': 'c' },
          subagents: {
            editor: {
              config: `export default { model: 'openai/gpt-4o', description: 'Edits' };`,
              instructions: 'e',
              workspaceSeed: { 'grandchild.txt': 'g' },
            },
          },
        },
      },
    });
    const bundleDir = join(dir, 'output');

    const mirrored = await mirrorFsAgentWorkspaces(dir, bundleDir);
    expect(mirrored.sort()).toEqual(['supervisor', 'supervisor/writer', 'supervisor/writer/editor']);
    expect(await readFile(join(bundleDir, 'workspace', 'supervisor', 'parent.txt'), 'utf-8')).toBe('p');
    expect(await readFile(join(bundleDir, 'workspace', 'supervisor', 'writer', 'child.txt'), 'utf-8')).toBe('c');
    expect(
      await readFile(join(bundleDir, 'workspace', 'supervisor', 'writer', 'editor', 'grandchild.txt'), 'utf-8'),
    ).toBe('g');
  });
});
