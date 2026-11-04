import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  GENERATED_MARKER,
  INTEGRATIONS_DIR,
  PARTIALS_DIR,
  REFERENCE_OUTPUT,
  assertSafeOutputs,
  extractTools,
  listToolProviders,
  planOutputs,
  writeOutputs,
} from '../../scripts/provider-docs-lib.js';
import type { DocsMetadata, Tool } from '../../scripts/provider-docs-lib.js';
import {
  CHANNEL_CONNECTIONS,
  CONNECT_GUIDE_PATH,
  EXCLUDED_PROVIDERS,
  MCP_PROVIDERS,
  TOOL_PROVIDERS,
} from '../../scripts/provider-docs-metadata.js';
import { CHANNELS } from '../providers/channels.js';
import { PROVIDERS } from '../providers/index.js';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '../..');

function writeTool(providersDir: string, provider: string, file: string, id: string, description: string) {
  const dir = join(providersDir, provider, 'tools');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, file),
    `export const tool = createTool({\n  id: '${id}',\n  description: ${description},\n  execute: async () => ({}),\n});\n`,
  );
}

function meta(overrides: Partial<DocsMetadata> = {}): DocsMetadata {
  return {
    connectGuidePath: '/docs/connect-guide',
    toolProviders: {
      acme: {
        name: 'Acme Calendar',
        canonicalPage: 'providers/acme.mdx',
        ownership: 'generated-page',
        summary: 'schedule meetings',
        note: 'Shared accounts can only read events.',
        emit: true,
      },
      chatty: {
        name: 'Chatty',
        logo: { slug: 'chatty', mono: true },
        canonicalPage: 'channels/chatty.mdx',
        ownership: 'handwritten-with-partial',
        summary: 'send messages',
        note: 'Bots need the messages scope.',
        emit: true,
      },
      quiet: { name: 'Quiet', canonicalPage: 'providers/quiet.mdx', ownership: 'generated-page' },
    },
    mcpProviders: {
      'remote-mcp': {
        name: 'Remote',
        canonicalPage: 'providers/remote.mdx',
        ownership: 'generated-page',
        summary: 'manage projects',
        mcpDocsUrl: 'https://remote.example/mcp',
        mcpDocsLabel: 'Remote MCP',
        emit: true,
      },
      'idle-mcp': {
        name: 'Idle',
        canonicalPage: 'providers/idle.mdx',
        ownership: 'generated-page',
        mcpDocsUrl: 'https://idle.example/mcp',
        mcpDocsLabel: 'Idle MCP',
      },
    },
    ...overrides,
  };
}

describe('Connect provider docs generation', () => {
  let root: string;
  let providersDir: string;
  let docsRoot: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'connect-provider-docs-'));
    providersDir = join(root, 'providers');
    docsRoot = join(root, 'docs');
    writeTool(providersDir, 'acme', 'z-list.ts', 'acme_list_events', `'Lists events | with a pipe'`);
    writeTool(providersDir, 'acme', 'a-create.ts', 'acme_create_event', `"Creates an \\"event\\""`);
    writeTool(providersDir, 'chatty', 'send.ts', 'chatty_send', '`Sends a message`');
    writeTool(providersDir, 'quiet', 'ping.ts', 'quiet_ping', `'Pings'`);
    writeTool(providersDir, 'hidden', 'secret.ts', 'hidden_secret', `'Not released'`);
    mkdirSync(join(providersDir, 'not-a-provider'), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function generate(metadata = meta()) {
    const providers = listToolProviders(providersDir, new Set(['hidden']));
    const toolsByProvider: Record<string, Tool[]> = {};
    for (const p of providers) toolsByProvider[p] = extractTools(providersDir, p);
    return writeOutputs(docsRoot, planOutputs(providers, toolsByProvider, metadata));
  }

  const read = (path: string) => readFileSync(join(docsRoot, path), 'utf8');

  it('documents every released toolset in the reference, sorted and escaped for tables', () => {
    generate();
    const reference = read(REFERENCE_OUTPUT);

    expect(reference).toContain('generated toolsets for 3 providers (4 tools');
    expect(reference).not.toContain('hidden_secret');
    expect(reference.indexOf('## Acme Calendar')).toBeLessThan(reference.indexOf('## Chatty'));
    expect(reference.indexOf('acme_create_event')).toBeLessThan(reference.indexOf('acme_list_events'));
    expect(reference).toContain('| `acme_list_events` | Lists events \\| with a pipe |');
    expect(reference).toContain('| `acme_create_event` | Creates an "event" |');
    expect(reference).toContain('| <ProviderLogo slug="chatty" mono /> [Chatty](#chatty) | `chatty` | 1 |');
    expect(reference).toContain(':::note\n\nShared accounts can only read events.\n\n:::');
  });

  it('writes a full integration page for a generated provider, linking setup and the reference', () => {
    generate();
    const page = read(join(INTEGRATIONS_DIR, 'providers/acme.mdx'));

    expect(page.startsWith('---\ntitle: "Acme Calendar | Providers"\n')).toBe(true);
    expect(page).toContain(GENERATED_MARKER);
    expect(page).toContain('[Connect setup](/docs/connect-guide#get-started)');
    expect(page).toContain('mastra connect add acme');
    expect(page).toContain("tools: tools({ providers: ['acme'] })");
    expect(page).toContain('The agent gets 2 Acme Calendar tools');
    expect(page).toContain('(/reference/connect/providers#acme-calendar)');
    // The reference owns the exhaustive list; the page doesn't repeat the table.
    expect(page).not.toContain('acme_list_events');
    expect(page).toContain('Shared accounts can only read events.');
  });

  it('writes a partial without frontmatter for a handwritten page, sharing the provider note', () => {
    generate();
    const partial = read(join(PARTIALS_DIR, 'chatty.mdx'));

    expect(partial.startsWith(GENERATED_MARKER)).toBe(true);
    expect(partial).not.toMatch(/^---/m);
    expect(partial).toContain('### Agent tools');
    expect(partial).not.toMatch(/^## /m);
    expect(partial).toContain('mastra connect add chatty');
    expect(partial).toContain('Bots need the messages scope.');
    expect(read(REFERENCE_OUTPUT)).toContain('Bots need the messages scope.');
  });

  it('describes MCP providers by runtime discovery, never by a generated tool count', () => {
    generate();
    const page = read(join(INTEGRATIONS_DIR, 'providers/remote.mdx'));

    expect(page).toContain("discovers Remote's tools from its MCP server when the agent runs");
    expect(page).toContain('[Remote MCP](https://remote.example/mcp)');
    expect(page).toContain('Tool keys start with `remote-mcp_`');
    expect(page).not.toMatch(/gets \d+ /);
    expect(read(REFERENCE_OUTPUT)).toContain(
      'MCP providers ([Idle](/integrations/providers/idle) and [Remote](/integrations/providers/remote))',
    );
  });

  it('emits only providers explicitly opted in', () => {
    const written = generate();
    expect(written).toEqual([
      REFERENCE_OUTPUT,
      join(INTEGRATIONS_DIR, 'providers/acme.mdx'),
      join(PARTIALS_DIR, 'chatty.mdx'),
      join(INTEGRATIONS_DIR, 'providers/remote.mdx'),
    ]);
  });

  it('refuses to overwrite a handwritten page and writes nothing', () => {
    const handwritten = join(docsRoot, INTEGRATIONS_DIR, 'providers/acme.mdx');
    mkdirSync(dirname(handwritten), { recursive: true });
    writeFileSync(handwritten, '# Acme\n\nWritten by hand.\n');

    expect(() => generate()).toThrow(/Refusing to overwrite .*providers\/acme\.mdx/);
    expect(readFileSync(handwritten, 'utf8')).toBe('# Acme\n\nWritten by hand.\n');
    expect(() => read(REFERENCE_OUTPUT)).toThrow();
  });

  it('overwrites its own marked output and leaves unrelated files alone', () => {
    generate();
    const unrelated = join(docsRoot, INTEGRATIONS_DIR, 'providers/other.mdx');
    writeFileSync(unrelated, '# Other\n');
    const partial = join(docsRoot, PARTIALS_DIR, 'chatty.mdx');
    writeFileSync(partial, `${GENERATED_MARKER}\n\nstale\n`);

    generate();
    expect(readFileSync(partial, 'utf8')).toContain('### Agent tools');
    expect(readFileSync(unrelated, 'utf8')).toBe('# Other\n');
  });

  it('produces byte-identical output on a second run', () => {
    const written = generate();
    const first = written.map(read);
    generate();
    expect(written.map(read)).toEqual(first);
  });

  it('rejects canonical pages outside an integrations category, and duplicates', () => {
    const escaping = meta();
    escaping.toolProviders.acme = { ...escaping.toolProviders.acme!, canonicalPage: '../reference/acme.mdx' };
    expect(() => generate(escaping)).toThrow(/must look like/);

    const duplicate = meta();
    duplicate.toolProviders.quiet = { ...duplicate.toolProviders.quiet!, canonicalPage: 'providers/acme.mdx' };
    expect(() => generate(duplicate)).toThrow(/already owned by acme/);
  });

  it('rejects output paths outside the allowed destinations', () => {
    expect(() => assertSafeOutputs([{ path: 'src/content/en/docs/connect.mdx', content: '' }])).toThrow(/Refusing/);
    expect(() => assertSafeOutputs([{ path: `${PARTIALS_DIR}/../x.mdx`, content: '' }])).toThrow(/Refusing/);
    expect(() =>
      assertSafeOutputs([
        { path: `${PARTIALS_DIR}/a.mdx`, content: '' },
        { path: `${PARTIALS_DIR}/a.mdx`, content: '' },
      ]),
    ).toThrow(/Duplicate/);
  });

  it('requires a summary for emitted providers and an existing toolset', () => {
    const noSummary = meta();
    delete noSummary.toolProviders.acme!.summary;
    expect(() => generate(noSummary)).toThrow(/acme: emitted providers need a summary/);

    const missing = meta();
    missing.toolProviders.ghost = {
      name: 'Ghost',
      canonicalPage: 'providers/ghost.mdx',
      ownership: 'generated-page',
      summary: 'haunt',
      emit: true,
    };
    expect(() => generate(missing)).toThrow(/ghost: emitted provider has no published toolset/);
  });
});

describe('Connect provider docs metadata matches the published catalog', () => {
  const published = listToolProviders(join(packageDir, 'src/providers'), EXCLUDED_PROVIDERS);

  it('has exactly one ownership record for every published toolset, and none for missing ones', () => {
    expect(Object.keys(TOOL_PROVIDERS).sort()).toEqual(published);
    for (const id of EXCLUDED_PROVIDERS) expect(TOOL_PROVIDERS[id]).toBeUndefined();
  });

  it('only documents registered tool providers and channels', () => {
    const registered = new Set(PROVIDERS.map(p => p.integrationId));
    for (const id of published) expect(registered.has(id)).toBe(true);
    expect(Object.keys(CHANNEL_CONNECTIONS).sort()).toEqual(CHANNELS.map(c => c.integrationId).sort());
  });

  it('keeps MCP providers out of the generated toolsets', () => {
    for (const id of Object.keys(MCP_PROVIDERS)) {
      expect(id.endsWith('-mcp')).toBe(true);
      expect(TOOL_PROVIDERS[id]).toBeUndefined();
    }
  });

  it('puts Slack tools and Slack chat on the same page', () => {
    expect(TOOL_PROVIDERS.slack!.canonicalPage).toBe('channels/slack.mdx');
    expect(CHANNEL_CONNECTIONS['slack-channels']!.canonicalPage).toBe('channels/slack.mdx');
  });

  it('gives each provider one canonical page, shared only by the same service', () => {
    const owners = new Map<string, Set<string>>();
    const add = (page: string, name: string) => owners.set(page, (owners.get(page) ?? new Set()).add(name));
    for (const p of [...Object.values(TOOL_PROVIDERS), ...Object.values(MCP_PROVIDERS)]) add(p.canonicalPage, p.name);
    for (const c of Object.values(CHANNEL_CONNECTIONS)) add(c.canonicalPage, c.name);
    for (const [page, names] of owners) expect([page, [...names]]).toEqual([page, [[...names][0]]]);
  });

  it('plans valid production outputs', () => {
    const toolsByProvider: Record<string, Tool[]> = {};
    for (const p of published) toolsByProvider[p] = extractTools(join(packageDir, 'src/providers'), p);
    const outputs = planOutputs(published, toolsByProvider, {
      connectGuidePath: CONNECT_GUIDE_PATH,
      toolProviders: TOOL_PROVIDERS,
      mcpProviders: MCP_PROVIDERS,
    });
    expect(outputs[0]!.path).toBe(REFERENCE_OUTPUT);
  });
});
