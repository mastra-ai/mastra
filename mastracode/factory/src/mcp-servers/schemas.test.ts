import { describe, expect, it } from 'vitest';

import { MCP_SERVER_LIMITS, createMcpServerSchemas, slugify, toolExposedName } from './schemas.js';

const { create, update, selectTools } = createMcpServerSchemas({ allowPrivateNetwork: false });

function createError(body: unknown): string | undefined {
  const result = create.safeParse(body);
  return result.success ? undefined : result.error.issues.map(issue => issue.message).join(' | ');
}

const bearer = { name: 'Docs', url: 'https://mcp.example.com/mcp', authType: 'headers' };

describe('slugify', () => {
  it('derives readable slugs from server names', () => {
    expect(slugify('GitHub Tools')).toBe('github-tools');
    expect(slugify('  Café Ünïcode!! ')).toBe('cafe-unicode');
    expect(slugify('Docs (prod) / v2')).toBe('docs-prod-v2');
  });

  it('caps long names without leaving a trailing separator', () => {
    const slug = slugify(`${'a'.repeat(39)} tail`);
    expect(slug).toBe('a'.repeat(39));
    expect(slugify('x'.repeat(100))).toHaveLength(40);
  });

  it('gives names without latin characters a stable, distinct slug', () => {
    expect(slugify('日本語')).toMatch(/^server-[0-9a-f]{6}$/);
    expect(slugify('日本語')).toBe(slugify('日本語'));
    expect(slugify('日本語')).not.toBe(slugify('中文'));
  });
});

describe('toolExposedName', () => {
  it('prefixes tool names with the server slug', () => {
    expect(toolExposedName('github-tools', 'create_issue')).toBe('github-tools_create_issue');
  });

  it('replaces characters model providers reject in tool names', () => {
    expect(toolExposedName('docs', 'search.v2/beta tool')).toBe('docs_search_v2_beta_tool');
  });

  it('keeps long names within 64 characters, unique, and stable', () => {
    const long = `${'very_long_tool_name_'.repeat(4)}a`;
    const other = `${'very_long_tool_name_'.repeat(4)}b`;
    const name = toolExposedName('docs', long);

    expect(name).toHaveLength(64);
    expect(name).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(toolExposedName('docs', long)).toBe(name);
    expect(toolExposedName('docs', other)).not.toBe(name);
  });
});

describe('createMcpServerSchemas', () => {
  it('turns header lists into a header map', () => {
    const parsed = create.parse({ ...bearer, headers: [{ name: 'Authorization', value: '  Bearer abc  ' }] });
    expect(parsed).toEqual({
      name: 'Docs',
      url: 'https://mcp.example.com/mcp',
      authType: 'headers',
      headers: { Authorization: 'Bearer abc' },
    });
  });

  it('applies the URL policy', () => {
    expect(createError({ name: 'x', url: 'http://mcp.example.com/mcp', authType: 'none' })).toMatch(/https/);
    expect(createError({ name: 'x', url: 'https://169.254.169.254/', authType: 'none' })).toMatch(/private network/);
    expect(
      createError({ name: 'x', url: `https://mcp.example.com/${'a'.repeat(2048)}`, authType: 'none' }),
    ).toBeDefined();

    const local = createMcpServerSchemas({ allowPrivateNetwork: true });
    expect(local.create.parse({ name: 'x', url: 'http://localhost:4111/mcp', authType: 'none' }).url).toBe(
      'http://localhost:4111/mcp',
    );
  });

  it.each(['Host', 'content-length', 'Connection', 'Transfer-Encoding', 'Mcp-Session-Id', 'MCP-Protocol-Version'])(
    'rejects the transport-owned header %s',
    name => {
      expect(createError({ ...bearer, headers: [{ name, value: 'x' }] })).toMatch(/set by the MCP connection/);
    },
  );

  it('rejects header values that could inject extra headers', () => {
    expect(createError({ ...bearer, headers: [{ name: 'X-Api-Key', value: 'abc\r\nX-Evil: 1' }] })).toMatch(
      /line breaks/,
    );
    expect(createError({ ...bearer, headers: [{ name: 'X-Api-Key', value: 'abc\nX-Evil: 1' }] })).toMatch(
      /line breaks/,
    );
  });

  it('rejects malformed, duplicate, and oversized headers', () => {
    expect(createError({ ...bearer, headers: [{ name: 'Bad Name', value: 'x' }] })).toMatch(/Header names/);
    expect(
      createError({
        ...bearer,
        headers: [
          { name: 'X-Key', value: 'a' },
          { name: 'x-key', value: 'b' },
        ],
      }),
    ).toMatch(/unique/);
    const tooMany = Array.from({ length: MCP_SERVER_LIMITS.headers + 1 }, (_, i) => ({ name: `X-${i}`, value: 'v' }));
    expect(createError({ ...bearer, headers: tooMany })).toBeDefined();
    expect(createError({ ...bearer, headers: [{ name: 'X-Key', value: 'v'.repeat(8193) }] })).toBeDefined();
    expect(createError({ ...bearer, headers: [{ name: 'X'.repeat(101), value: 'v' }] })).toBeDefined();
    expect(createError({ ...bearer, headers: [] })).toMatch(/at least one header/);
  });

  it('requires the fields each authentication type uses and nothing else', () => {
    expect(createError(bearer)).toMatch(/at least one header/);
    expect(
      createError({
        name: 'x',
        url: 'https://mcp.example.com/',
        authType: 'none',
        headers: [{ name: 'A', value: 'b' }],
      }),
    ).toMatch(/only used with header authentication/);
    expect(
      createError({ name: 'x', url: 'https://mcp.example.com/', authType: 'none', oauth: { clientId: 'c' } }),
    ).toMatch(/only used with OAuth/);
    expect(
      createError({ name: 'x', url: 'https://mcp.example.com/', authType: 'oauth', oauth: { clientSecret: 's' } }),
    ).toMatch(/needs a client ID/);
    expect(
      create.parse({
        name: 'x',
        url: 'https://mcp.example.com/',
        authType: 'oauth',
        oauth: { clientId: 'c', scopes: ['read', 'read', 'write'] },
      }).oauth,
    ).toEqual({ clientId: 'c', scopes: ['read', 'write'] });
  });

  it('limits OAuth scopes', () => {
    const oauth = (scopes: string[]) =>
      createError({ name: 'x', url: 'https://mcp.example.com/', authType: 'oauth', oauth: { scopes } });
    expect(oauth(['read write'])).toMatch(/Scopes cannot contain spaces/);
    expect(oauth(Array.from({ length: MCP_SERVER_LIMITS.scopes + 1 }, (_, i) => `s${i}`))).toBeDefined();
  });

  it('limits names and rejects unknown fields', () => {
    expect(createError({ ...bearer, name: ' ', headers: [{ name: 'A', value: 'b' }] })).toMatch(/Enter a name/);
    expect(createError({ ...bearer, name: 'n'.repeat(101), headers: [{ name: 'A', value: 'b' }] })).toBeDefined();
    expect(
      createError({ name: 'x', url: 'https://mcp.example.com/', authType: 'none', command: 'rm -rf /' }),
    ).toBeDefined();
  });

  it('accepts partial updates and explicit clears', () => {
    expect(update.safeParse({}).success).toBe(false);
    expect(update.parse({ name: 'Renamed' })).toEqual({ name: 'Renamed' });
    expect(update.parse({ oauth: { clientId: null, clientSecret: null } })).toEqual({
      oauth: { clientId: null, clientSecret: null },
    });
    expect(update.safeParse({ oauth: { clientId: null, clientSecret: 's' } }).success).toBe(false);
    expect(update.safeParse({ authType: 'none', headers: [{ name: 'A', value: 'b' }] }).success).toBe(false);
  });

  it('de-duplicates and caps tool selections', () => {
    expect(selectTools.parse({ selected: ['a', 'b', 'a'] })).toEqual({ selected: ['a', 'b'] });
    expect(
      selectTools.safeParse({ selected: Array.from({ length: MCP_SERVER_LIMITS.tools + 1 }, (_, i) => `t${i}`) })
        .success,
    ).toBe(false);
  });
});
