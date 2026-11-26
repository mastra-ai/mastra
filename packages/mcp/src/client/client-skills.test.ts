import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { serveHTTP } from '../server/__tests__/harness.mock';
import type { ServedHTTP } from '../server/__tests__/harness.mock';
import { MCPServer } from '../server/server';
import type { SkillSource } from '../server/skills';
import { MCPClient } from './configuration';
import { SkillVerificationError } from './index';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const skillMd = `---\nname: release\ndescription: Cut a release\n---\n\n# Release\nRead [steps](references/STEPS.md).\n`;

describe('MCPClient skills', () => {
  let withSkills: ServedHTTP;
  let without: ServedHTTP;
  let mcp: MCPClient;

  beforeAll(async () => {
    withSkills = await serveHTTP(
      new MCPServer({
        name: 'Skills',
        version: '1.0.0',
        tools: {},
        skills: { files: { 'release/SKILL.md': skillMd, 'release/references/STEPS.md': '1. tag\n2. publish\n' } },
      }),
    );
    without = await serveHTTP(new MCPServer({ name: 'Plain', version: '1.0.0', tools: {} }));
    mcp = new MCPClient({
      id: 'skills-client-test',
      servers: { docs: { url: withSkills.url }, plain: { url: without.url } },
    });
  });

  afterAll(async () => {
    await mcp.disconnect();
    await withSkills.close();
    await without.close();
  });

  it('lists skills per server, with none for a server without the extension', async () => {
    const listed = await mcp.skills.list();
    expect(listed.plain).toEqual([]);
    expect(listed.docs?.map(skill => skill.uri)).toEqual(['skill://release/SKILL.md']);
    expect(listed.docs?.[0]?.frontmatter).toEqual({ name: 'release', description: 'Cut a release' });
  });

  it('gets, reads and walks a skill with verified files', async () => {
    const skill = await mcp.skills.get('docs', 'skill://release/SKILL.md');
    const manifest = await mcp.skills.read('docs', skill);
    expect(manifest).toMatchObject({ verified: true, frontmatter: { name: 'release' } });
    expect(manifest.body).toContain('# Release');

    expect((await mcp.skills.read('docs', skill, 'references/STEPS.md')).text).toBe('1. tag\n2. publish\n');
    expect(await mcp.skills.readDirectory('docs', 'skill://release/references')).toEqual([
      { uri: 'skill://release/references/STEPS.md', name: 'STEPS.md', mimeType: 'text/markdown', size: 18 },
    ]);
  });

  it('refuses files the server did not list for the skill', async () => {
    const skill = await mcp.skills.get('docs', 'skill://release/SKILL.md');
    const error = await mcp.skills.read('docs', skill, 'references/OTHER.md').catch(e => e);
    expect(error.id).toBe('MCP_CLIENT_READ_SKILL_FAILED');
    expect(error.cause).toBeInstanceOf(SkillVerificationError);
    expect(error.cause.reason).toBe('unlisted');

    // An entry altered after listing no longer matches what the server serves.
    const tampered = {
      ...skill,
      resources: (skill.resources as { uri: string; digest: string; size: number }[]).map(r =>
        r.uri.endsWith('STEPS.md') ? { ...r, digest: `sha256:${'0'.repeat(64)}` } : r,
      ),
    };
    const digest = await mcp.skills.read('docs', tampered, 'references/STEPS.md').catch(e => e);
    expect(digest.cause).toMatchObject({ reason: 'digest' });

    await expect(mcp.skills.get('docs', 'skill://nope/SKILL.md')).rejects.toMatchObject({
      id: 'MCP_CLIENT_GET_SKILL_FAILED',
    });
  });
});

describe('MCPClient skills timeout', () => {
  it('applies the configured timeout to skill requests', async () => {
    let release!: () => void;
    const stalled = new Promise<void>(resolve => (release = resolve));
    const source: SkillSource = {
      list: async () => {
        await stalled;
        return { skills: [] };
      },
      get: async () => {
        await stalled;
        return undefined;
      },
      read: async () => undefined,
    };
    const served = await serveHTTP(new MCPServer({ name: 'Slow', version: '1.0.0', tools: {}, skills: { source } }));
    const mcp = new MCPClient({ id: 'skills-timeout-test', servers: { slow: { url: served.url } }, timeout: 300 });
    try {
      const started = Date.now();
      // A server that fails to list is logged and left out.
      expect(await mcp.skills.list()).toEqual({});
      const error = await mcp.skills.get('slow', 'skill://a/SKILL.md').catch(e => e);
      expect(error.cause).toMatchObject({ code: 'REQUEST_TIMEOUT', data: { timeout: 300 } });
      expect(Date.now() - started).toBeLessThan(5_000);
    } finally {
      release();
      await mcp.disconnect();
      await served.close();
    }
  });
});
