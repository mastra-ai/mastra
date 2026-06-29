import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateFsAgentsModule } from './codegen';
import { discoverFsAgents } from './discover';
import { mirrorFsAgentWorkspaces } from './mirror';
import { prepareFsAgentsEntry } from './prepare';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fs-routing-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeAgent(
  name: string,
  files: {
    config?: string;
    instructions?: string;
    workspace?: string;
    /** Map of relative path under `workspace/` to seed file content. */
    workspaceSeed?: Record<string, string>;
    tools?: Record<string, string>;
    /** Map of relative path under `skills/` to file content. */
    skills?: Record<string, string>;
  },
) {
  const agentDir = join(dir, 'agents', name);
  await mkdir(agentDir, { recursive: true });
  if (files.config !== undefined) {
    await writeFile(join(agentDir, 'config.ts'), files.config);
  }
  if (files.instructions !== undefined) {
    await writeFile(join(agentDir, 'instructions.md'), files.instructions);
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

  it('discovers a flat markdown skill, defaulting name to the filename', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
      skills: { 'faq.md': `# FAQ\nAnswer questions.` },
    });

    const skill = (await discoverFsAgents(dir))[0]!.skills[0]!;
    expect(skill).toMatchObject({ kind: 'packaged', name: 'faq' });
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
    expect(source).toContain(`export const mastra = __userEntry.mastra;`);
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
});

describe('prepareFsAgentsEntry', () => {
  it('returns the original entry unchanged when there are no fs agents', async () => {
    const out = join(dir, '.mastra');
    const result = await prepareFsAgentsEntry(dir, '/project/index.ts', out);
    expect(result).toEqual({ entryFile: '/project/index.ts', toolPaths: [], agentCount: 0 });
  });

  it('writes a wrapper entry and tool paths when fs agents exist', async () => {
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

  it('mirrors nothing when no agent has a workspace/ seed dir', async () => {
    await writeAgent('weather', {
      config: `export default { model: 'openai/gpt-4o' };`,
      instructions: 'hi',
    });
    const bundleDir = join(dir, 'output');

    expect(await mirrorFsAgentWorkspaces(dir, bundleDir)).toEqual([]);
  });
});
