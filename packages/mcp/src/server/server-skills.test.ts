import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { SKILLS_EXTENSION_ID, SkillsClient, SkillVerificationError } from '@modelcontextprotocol/client/ext/skills';
import { memorySkillFiles, skillEntry } from '@modelcontextprotocol/server/ext/skills';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { connectClient, rawRequest, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';
import type { MCPServerSkills, SkillSource } from './skills';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const skillMd = (name: string, description: string, body = '') =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n${body}`;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00, 0xfe]);

const skills: MCPServerSkills = {
  files: {
    'git-workflow/SKILL.md': skillMd(
      'git-workflow',
      'Branch, commit and open PRs',
      'See [refs](references/REFERENCE.md).',
    ),
    'git-workflow/references/REFERENCE.md': '# Reference\n',
    'git-workflow/scripts/check.sh': '#!/bin/sh\necho ok\n',
    'git-workflow/assets/logo.png': PNG,
    'pdf/SKILL.md': skillMd('pdf', 'Read and fill PDF forms'),
    'pdf/forms/FORMS.md': '# Forms\n',
    'broken/SKILL.md': '# no frontmatter\n',
  },
};

function createServer(config: MCPServerSkills | false = skills) {
  return new MCPServer({
    name: 'Skills',
    version: '1.0.0',
    legacy: 'stateless',
    skills: config || undefined,
    tools: {},
  });
}

describe('MCPServer skills (SEP-2640)', () => {
  let served: ServedHTTP;

  beforeAll(async () => {
    served = await serveHTTP(createServer());
  });

  afterAll(async () => {
    await served.close();
  });

  it('declares the extension with directory reads, and resources', async () => {
    const client = await connectClient(served.url);
    try {
      const capabilities = client.getServerCapabilities();
      expect(capabilities?.extensions).toEqual({ [SKILLS_EXTENSION_ID]: { directoryRead: true } });
      expect(capabilities?.resources).toBeDefined();
      const skillsClient = new SkillsClient(client);
      expect(skillsClient.supported).toBe(true);
      expect(skillsClient.directoryRead).toBe(true);
    } finally {
      await client.close();
    }
  });

  it('lists, gets and reads every skill file with its digest verified', async () => {
    const client = await connectClient(served.url);
    try {
      const skillsClient = new SkillsClient(client);
      const listing = await skillsClient.list();
      expect(listing.invalid).toEqual([]);
      expect(listing.ttlMs).toBe(0);
      expect(listing.cacheScope).toBe('private');
      // The skill without frontmatter is left out rather than served invalid.
      expect(listing.skills.map(s => s.uri)).toEqual(['skill://git-workflow/SKILL.md', 'skill://pdf/SKILL.md']);

      const git = listing.skills[0]!;
      expect(git.frontmatter).toEqual({ name: 'git-workflow', description: 'Branch, commit and open PRs' });
      expect(Array.isArray(git.resources) && git.resources.map(r => r.uri).sort()).toEqual([
        'skill://git-workflow/SKILL.md',
        'skill://git-workflow/assets/logo.png',
        'skill://git-workflow/references/REFERENCE.md',
        'skill://git-workflow/scripts/check.sh',
      ]);

      const manifest = await skillsClient.read(git);
      expect(manifest.verified).toBe(true);
      expect(manifest.mimeType).toBe('text/markdown');
      expect(manifest.frontmatter).toEqual(git.frontmatter);
      expect(manifest.body).toContain('# git-workflow');

      const reference = await skillsClient.read(git, 'references/REFERENCE.md');
      expect(reference).toMatchObject({ verified: true, text: '# Reference\n', mimeType: 'text/markdown' });
      expect((await skillsClient.read(git, 'scripts/check.sh')).mimeType).toBe('application/x-sh');

      const logo = await skillsClient.read(git, 'assets/logo.png');
      expect(logo).toMatchObject({ verified: true, mimeType: 'image/png' });
      expect(logo.text).toBeUndefined();
      expect([...logo.bytes]).toEqual([...PNG]);

      expect((await skillsClient.get('skill://pdf/SKILL.md')).skill).toEqual(listing.skills[1]);
    } finally {
      await client.close();
    }
  });

  it('refuses unknown skills and unlisted files', async () => {
    const client = await connectClient(served.url);
    try {
      const skillsClient = new SkillsClient(client);
      await expect(skillsClient.get('skill://nope/SKILL.md')).rejects.toMatchObject({ code: -32602 });
      await expect(skillsClient.get('skill://broken/SKILL.md')).rejects.toMatchObject({ code: -32602 });
      const [git] = (await skillsClient.list()).skills;
      await expect(skillsClient.read(git!, 'references/MISSING.md')).rejects.toBeInstanceOf(SkillVerificationError);
      await expect(client.readResource({ uri: 'skill://git-workflow/MISSING.md' })).rejects.toThrow();
      // A skill's directory is not a file.
      await expect(client.readResource({ uri: 'skill://git-workflow/references' })).rejects.toThrow(
        /resources\/directory\/read/,
      );
    } finally {
      await client.close();
    }
  });

  it('reads skill directories', async () => {
    const client = await connectClient(served.url);
    try {
      const skillsClient = new SkillsClient(client);
      const root = await skillsClient.readDirectory('skill://git-workflow');
      expect(root.resources).toEqual([
        { uri: 'skill://git-workflow/SKILL.md', name: 'SKILL.md', mimeType: 'text/markdown', size: expect.any(Number) },
        { uri: 'skill://git-workflow/assets', name: 'assets', mimeType: 'inode/directory' },
        { uri: 'skill://git-workflow/references', name: 'references', mimeType: 'inode/directory' },
        { uri: 'skill://git-workflow/scripts', name: 'scripts', mimeType: 'inode/directory' },
      ]);
      expect((await skillsClient.readDirectory('skill://pdf/forms')).resources).toEqual([
        { uri: 'skill://pdf/forms/FORMS.md', name: 'FORMS.md', mimeType: 'text/markdown', size: 8 },
      ]);
      await expect(skillsClient.readDirectory('skill://nope')).rejects.toMatchObject({ code: -32602 });
    } finally {
      await client.close();
    }
  });

  it('lists each SKILL.md as a resource', async () => {
    const client = await connectClient(served.url);
    try {
      expect((await client.listResources()).resources).toEqual([
        {
          uri: 'skill://git-workflow/SKILL.md',
          name: 'git-workflow',
          description: 'Branch, commit and open PRs',
          mimeType: 'text/markdown',
          size: expect.any(Number),
        },
        {
          uri: 'skill://pdf/SKILL.md',
          name: 'pdf',
          description: 'Read and fill PDF forms',
          mimeType: 'text/markdown',
          size: expect.any(Number),
        },
      ]);
    } finally {
      await client.close();
    }
  });

  it('serves a 2025-era client the extension and plain resources', async () => {
    const client = new Client({ name: 'legacy', version: '1.0.0' }, { versionNegotiation: { mode: 'legacy' } });
    await client.connect(new StreamableHTTPClientTransport(served.url));
    try {
      expect(client.getServerCapabilities()?.extensions).toEqual({ [SKILLS_EXTENSION_ID]: { directoryRead: true } });
      const skillsClient = new SkillsClient(client);
      const { skills: entries } = await skillsClient.list();
      expect(entries).toHaveLength(2);
      expect((await skillsClient.read(entries[1]!, 'forms/FORMS.md')).text).toBe('# Forms\n');
      const read = await client.readResource({ uri: 'skill://pdf/SKILL.md' });
      expect(read.contents[0]).toMatchObject({ mimeType: 'text/markdown', text: expect.stringContaining('name: pdf') });
    } finally {
      await client.close();
    }
  });

  it('leaves the methods off a server without skills', async () => {
    const plain = await serveHTTP(createServer(false));
    try {
      const client = await connectClient(plain.url);
      try {
        expect(client.getServerCapabilities()?.extensions).toBeUndefined();
        expect(new SkillsClient(client).supported).toBe(false);
      } finally {
        await client.close();
      }
      const response = await rawRequest(plain.url, { method: 'skills/list', params: {} });
      expect(response.json().error).toMatchObject({ code: -32601 });
    } finally {
      await plain.close();
    }
  });
});

describe('MCPServer skills options', () => {
  it('pages listings and directories, and serves under a prefix', async () => {
    const served = await serveHTTP(
      createServer({
        prefix: 'acme',
        pageSize: 1,
        cacheHint: { ttlMs: 60_000, cacheScope: 'public' },
        files: {
          'a/SKILL.md': skillMd('a', 'A'),
          'a/one.md': '1',
          'a/two.md': '2',
          'b/SKILL.md': skillMd('b', 'B'),
        },
      }),
    );
    try {
      const client = await connectClient(served.url);
      try {
        const skillsClient = new SkillsClient(client);
        const first = await skillsClient.list({ cursor: undefined });
        expect(first.skills.map(s => s.uri)).toEqual(['skill://acme/a/SKILL.md', 'skill://acme/b/SKILL.md']);
        expect(first).toMatchObject({ ttlMs: 60_000, cacheScope: 'public' });

        const page = await rawRequest(served.url, { method: 'skills/list', params: {} });
        expect(page.json().result.skills).toHaveLength(1);
        expect(page.json().result.nextCursor).toBe('1');
        const bad = await rawRequest(served.url, { method: 'skills/list', params: { cursor: 'x' } });
        expect(bad.json().error).toMatchObject({ code: -32602 });

        expect((await skillsClient.readDirectory('skill://acme/a')).resources.map(r => r.name)).toEqual([
          'SKILL.md',
          'one.md',
          'two.md',
        ]);
        const [a] = first.skills;
        expect((await skillsClient.read(a!, 'two.md')).text).toBe('2');
      } finally {
        await client.close();
      }
    } finally {
      await served.close();
    }
  });

  it('serves skills alongside the server’s own resources', async () => {
    const server = new MCPServer({
      name: 'Both',
      version: '1.0.0',
      legacy: 'stateless',
      tools: {},
      skills: { files: { 'a/SKILL.md': skillMd('a', 'A') } },
      resources: {
        listResources: async () => [{ uri: 'file://notes.txt', name: 'notes' }],
        getResourceContent: async () => ({ text: 'notes' }),
      },
    });
    const served = await serveHTTP(server);
    try {
      const client = await connectClient(served.url);
      try {
        expect((await client.listResources()).resources.map(r => r.uri)).toEqual([
          'skill://a/SKILL.md',
          'file://notes.txt',
        ]);
        expect((await client.readResource({ uri: 'file://notes.txt' })).contents[0]).toMatchObject({ text: 'notes' });
        expect((await new SkillsClient(client).read((await new SkillsClient(client).list()).skills[0]!)).verified).toBe(
          true,
        );
      } finally {
        await client.close();
      }
    } finally {
      await served.close();
    }
  });
});

describe('MCPServer skills from a Mastra filesystem', () => {
  let base: string;

  beforeAll(async () => {
    base = await mkdtemp(join(tmpdir(), 'mcp-skills-'));
    await mkdir(join(base, 'skills', 'demo', 'references'), { recursive: true });
    await writeFile(join(base, 'skills', 'demo', 'SKILL.md'), skillMd('demo', 'Demo skill'));
    await writeFile(join(base, 'skills', 'demo', 'references', 'NOTES.md'), 'notes');
    await writeFile(join(base, 'skills', 'demo', 'secret.txt'), 'secret');
    await symlink(join(base, 'skills', 'demo', 'secret.txt'), join(base, 'skills', 'demo', 'link.txt'));
    await writeFile(join(base, 'README.md'), 'outside the skills folder');
  });

  afterAll(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it("serves a workspace's skills folder, reading files when clients ask for them", async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: base }) });
    const filesystem = workspace.filesystem!;
    const readFile = vi.spyOn(filesystem, 'readFile');
    const served = await serveHTTP(createServer({ files: filesystem, root: 'skills' }));
    try {
      const client = await connectClient(served.url);
      try {
        const skillsClient = new SkillsClient(client);
        const [demo] = (await skillsClient.list()).skills;
        expect(demo?.uri).toBe('skill://demo/SKILL.md');
        // The symbolic link is left out; everything else under the skill is listed.
        expect(Array.isArray(demo!.resources) && demo!.resources.map(r => r.uri).sort()).toEqual([
          'skill://demo/SKILL.md',
          'skill://demo/references/NOTES.md',
          'skill://demo/secret.txt',
        ]);
        // Listing hashed each file once; nothing is read again until a client asks.
        expect(readFile).toHaveBeenCalledTimes(3);
        await skillsClient.list();
        expect(readFile).toHaveBeenCalledTimes(3);

        const notes = await skillsClient.read(demo!, 'references/NOTES.md');
        expect(notes).toMatchObject({ verified: true, text: 'notes' });
        expect(readFile).toHaveBeenCalledTimes(4);
        expect(readFile).toHaveBeenLastCalledWith('skills/demo/references/NOTES.md');

        await expect(client.readResource({ uri: 'skill://README.md' })).rejects.toThrow();
        await expect(client.readResource({ uri: 'skill://demo/link.txt' })).rejects.toThrow();
      } finally {
        await client.close();
      }
    } finally {
      await served.close();
    }
  });

  it('fails a read of a file that changed since it was listed, then lists it afresh', async () => {
    const served = await serveHTTP(createServer({ files: new LocalFilesystem({ basePath: join(base, 'skills') }) }));
    try {
      const client = await connectClient(served.url);
      try {
        const skillsClient = new SkillsClient(client);
        const [before] = (await skillsClient.list()).skills;
        await writeFile(join(base, 'skills', 'demo', 'references', 'NOTES.md'), 'new notes');
        await expect(client.readResource({ uri: 'skill://demo/references/NOTES.md' })).rejects.toThrow(
          /changed since it was listed/,
        );
        const [after] = (await skillsClient.list()).skills;
        expect(after).not.toEqual(before);
        expect(await skillsClient.read(after!, 'references/NOTES.md')).toMatchObject({
          verified: true,
          text: 'new notes',
        });
      } finally {
        await client.close();
      }
    } finally {
      await served.close();
    }
  });
});

describe('MCPServer skills from other sources', () => {
  it('reads through an MCP SDK SkillFiles adapter', async () => {
    const files = memorySkillFiles({ 'catalog/a/SKILL.md': skillMd('a', 'A'), 'catalog/a/notes.md': 'n' });
    const served = await serveHTTP(createServer({ files, root: 'catalog' }));
    try {
      const client = await connectClient(served.url);
      try {
        const skillsClient = new SkillsClient(client);
        const [a] = (await skillsClient.list()).skills;
        expect(a?.uri).toBe('skill://a/SKILL.md');
        expect(await skillsClient.read(a!, 'notes.md')).toMatchObject({ verified: true, text: 'n' });
      } finally {
        await client.close();
      }
    } finally {
      await served.close();
    }
  });

  it('serves a custom SkillSource, without directory reads when it has none', async () => {
    const report = skillMd('report', 'Weekly report for the caller');
    const reads: string[] = [];
    const source: SkillSource = {
      async list() {
        return {
          skills: [
            await skillEntry('report', { 'SKILL.md': report }),
            {
              uri: 'skill://live/SKILL.md',
              frontmatter: { name: 'live', description: 'Generated' },
              resources: 'dynamic',
            },
          ],
        };
      },
      async get(uri) {
        return (await this.list({}, undefined as never)).skills.find(skill => skill.uri === uri);
      },
      async read(uri) {
        reads.push(uri);
        if (uri === 'skill://report/SKILL.md') return { text: report, mimeType: 'text/markdown' };
        if (uri === 'skill://live/SKILL.md') return { text: skillMd('live', 'Generated', `at ${reads.length}`) };
        if (uri === 'skill://live/data.bin') return { bytes: PNG, mimeType: 'image/png' };
        return undefined;
      },
      async listResources() {
        return [{ uri: 'skill://report/SKILL.md', name: 'report', mimeType: 'text/markdown' }];
      },
    };
    const served = await serveHTTP(createServer({ source, cacheHint: { ttlMs: 1000, cacheScope: 'private' } }));
    try {
      const client = await connectClient(served.url);
      try {
        expect(client.getServerCapabilities()?.extensions).toEqual({ [SKILLS_EXTENSION_ID]: { directoryRead: false } });
        const skillsClient = new SkillsClient(client);
        const listing = await skillsClient.list();
        expect(listing).toMatchObject({ ttlMs: 1000, cacheScope: 'private' });
        const [reportSkill, live] = listing.skills;
        expect(await skillsClient.read(reportSkill!)).toMatchObject({ verified: true, mimeType: 'text/markdown' });
        expect((await skillsClient.read(live!)).body).toContain('at 2');
        const blob = await client.readResource({ uri: 'skill://live/data.bin' });
        expect(blob.contents[0]).toMatchObject({ mimeType: 'image/png', blob: btoa(String.fromCharCode(...PNG)) });
        expect((await client.listResources()).resources.map(r => r.uri)).toEqual(['skill://report/SKILL.md']);
        await expect(skillsClient.get('skill://nope/SKILL.md')).rejects.toMatchObject({ code: -32602 });
        await expect(client.readResource({ uri: 'skill://nope/SKILL.md' })).rejects.toThrow();
        const directory = await rawRequest(served.url, {
          method: 'resources/directory/read',
          params: { uri: 'skill://report' },
        });
        expect(directory.json().error).toMatchObject({ code: -32601 });
      } finally {
        await client.close();
      }
    } finally {
      await served.close();
    }
  });
});
