import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { RequestContext } from '@mastra/core/request-context';
import { isValidationError } from '@mastra/core/tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { tools } from '../tools.js';

// The Figma tools run through the public `tools()` resolver against a real
// HTTP server standing in for the Mastra platform, so each test sees the exact
// request that would reach Figma through the proxy.

interface ResolvedTool {
  execute?: (input: unknown, context: { requestContext: RequestContext }) => Promise<unknown>;
}

const connection = {
  id: 'fg_test',
  integrationId: 'figma',
  status: 'active',
  connectedByUserId: 'user_1',
  connectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  accountLabel: 'designer@example.com',
  displayName: null,
  resourceId: null,
};

const integration = {
  id: 'figma',
  provider: 'figma',
  displayName: 'Figma',
  logoUrl: '',
  authType: 'OAUTH2',
  authFields: [],
  capabilities: { proxy: true, webhooks: false, mcp: false },
  surfaces: ['tools'],
  comingSoon: false,
  minConnectVersion: null,
};

const PROXY_PREFIX = `/v2/connections/${connection.id}/proxy`;

interface RecordedRequest {
  method: string | undefined;
  path: string;
  query: Record<string, string>;
  body?: unknown;
}

const user = { id: '7', handle: 'Ada', img_url: 'https://example.com/ada.png' };

function comment(overrides: Record<string, unknown> = {}) {
  return {
    id: '100',
    file_key: 'FILE',
    message: 'Looks good',
    user,
    created_at: '2026-01-01T00:00:00Z',
    resolved_at: null,
    order_id: '1',
    reactions: [],
    client_meta: { x: 10, y: 20 },
    ...overrides,
  };
}

function version(id: string) {
  return { id, created_at: '2026-01-01T00:00:00Z', label: null, description: null, user };
}

const frame = {
  nodeId: '1:2',
  name: 'Buttons',
  pageId: '0:1',
  pageName: 'Library',
  containingStateGroup: null,
  containingComponentSet: null,
};

function published(key: string) {
  return {
    key,
    file_key: 'FILE',
    node_id: '1:3',
    name: 'Button',
    description: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    user,
    containing_frame: frame,
  };
}

describe('Figma tools', () => {
  let server: Server;
  let baseUrl: string;
  let requests: RecordedRequest[];
  let answer: (request: RecordedRequest) => { status: number; body: unknown };

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      const target = request.url ?? '/';
      const send = (status: number, body: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(body === undefined ? '' : JSON.stringify(body));
      };
      if (target.endsWith('/connections')) return send(200, { connections: [connection] });
      if (target.endsWith('/integrations')) return send(200, { integrations: [integration] });
      if (!target.startsWith(PROXY_PREFIX)) return send(404, { error: `unexpected request ${target}` });
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks).toString('utf8');
      const url = new URL(target.slice(PROXY_PREFIX.length), 'http://figma.invalid');
      const recorded: RecordedRequest = {
        method: request.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        ...(raw && { body: JSON.parse(raw) }),
      };
      requests.push(recorded);
      const { status, body } = answer(recorded);
      send(status, body);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  beforeEach(() => {
    requests = [];
    answer = () => ({ status: 204, body: undefined });
  });

  let resolutions = 0;
  async function run(toolId: string, input: Record<string, unknown>) {
    const resolved = await tools({
      providers: { figma: { connectionId: connection.id } },
      allowTools: [toolId],
      projectId: `proj_${++resolutions}`,
      client: { accessToken: 'test-platform-token', baseUrl },
    })();
    const tool = resolved[toolId] as ResolvedTool | undefined;
    if (!tool?.execute) throw new Error(`${toolId} was not resolved`);
    const result = await tool.execute(input, { requestContext: new RequestContext() });
    if (isValidationError(result)) throw new Error(`${toolId} failed validation: ${result.message}`);
    return result;
  }

  describe('retries', () => {
    it.each([
      [
        'figma_create_dev_resources',
        { dev_resources: [{ name: 'Ticket', url: 'https://example.com/1', file_key: 'FILE', node_id: '1:2' }] },
        'POST',
      ],
      [
        'figma_update_variables',
        { file_key: 'FILE', variableCollections: [{ action: 'CREATE', name: 'Tokens' }] },
        'POST',
      ],
      ['figma_create_comment', { file_key: 'FILE', message: 'Hi' }, 'POST'],
    ])('%s does not replay a write after a transient 5xx', async (toolId, input, method) => {
      answer = () => ({ status: 502, body: { error: 'bad gateway' } });

      await expect(run(toolId, input)).rejects.toThrow();

      expect(requests).toEqual([expect.objectContaining({ method })]);
    });

    it('still retries reads after a transient 5xx', async () => {
      answer = () => ({ status: 502, body: { error: 'bad gateway' } });

      await expect(run('figma_get_current_user', {})).rejects.toThrow();

      expect(requests).toHaveLength(3);
    });
  });

  describe('comments', () => {
    it('reads a comment that has no pin', async () => {
      answer = () => ({ status: 200, body: { comments: [comment({ client_meta: null }), comment({ id: '101' })] } });

      const result = (await run('figma_list_comments', { file_key: 'FILE' })) as {
        items: Array<Record<string, unknown>>;
      };

      expect(result.items[0]).not.toHaveProperty('client_meta');
      expect(result.items[1]).toMatchObject({ id: '101', client_meta: { x: 10, y: 20 } });
    });

    it('keeps the size of a region pin and reads unresolved comments and replies', async () => {
      const region = { x: 1, y: 2, region_width: 30, region_height: 40, comment_pin_corner: 'top-left' };
      const { resolved_at: _omitted, ...unresolved } = comment({ id: '101', client_meta: region });
      answer = () => ({
        status: 200,
        body: { comments: [unresolved, comment({ id: '102', parent_id: '101', order_id: null })] },
      });

      const result = (await run('figma_list_comments', { file_key: 'FILE' })) as {
        items: Array<Record<string, unknown>>;
        next_cursor?: string;
      };

      expect(result.items[0]).toMatchObject({ id: '101', client_meta: region });
      expect(result.items[0]).not.toHaveProperty('resolved_at');
      expect(result.items[1]).toMatchObject({ id: '102', parent_id: '101' });
      expect(result.items[1]).not.toHaveProperty('order_id');
      expect(result).not.toHaveProperty('next_cursor');
    });

    it('keeps a node-region pin rather than reading it as a plain node offset', async () => {
      const pin = { node_id: '1:2', node_offset: { x: 3, y: 4 }, region_width: 50, region_height: 60 };
      answer = () => ({ status: 200, body: { comments: [comment({ client_meta: pin })] } });

      const result = (await run('figma_list_comments', { file_key: 'FILE' })) as {
        items: Array<Record<string, unknown>>;
      };

      expect(result.items[0]!.client_meta).toEqual(pin);
    });

    it('reads a reply and the canvas position of a comment', async () => {
      answer = () => ({
        status: 200,
        body: { comments: [comment({ id: '102', parent_id: '101', order_id: null, client_meta: { x: 10, y: 20 } })] },
      });

      const result = await run('figma_get_comment', { file_key: 'FILE', comment_id: '102' });

      expect(result).toMatchObject({ id: '102', parent_id: '101', client_meta: { x: 10, y: 20 } });
      expect(result).not.toHaveProperty('order_id');
    });

    it('reads a reactions page link that has no origin', async () => {
      answer = () => ({
        status: 200,
        body: {
          reactions: [{ user, emoji: ':+1:', created_at: '2026-01-01T00:00:00Z' }],
          pagination: { next_page: '/v1/files/FILE/comments/100/reactions?cursor=abc' },
        },
      });

      const result = await run('figma_list_comment_reactions', { file_key: 'FILE', comment_id: '100' });

      expect(result).toMatchObject({ next_cursor: 'abc' });
    });
  });

  describe('versions', () => {
    it('pages back to older versions with the cursor Figma links to', async () => {
      answer = () => ({
        status: 200,
        body: {
          versions: [version('30'), version('20')],
          pagination: { next_page: 'https://api.figma.com/v1/files/FILE/versions?page_size=2&before=20' },
        },
      });

      const first = await run('figma_list_versions', { file_key: 'FILE', page_size: 2 });
      await run('figma_list_versions', { file_key: 'FILE', page_size: 2, cursor: '30' });

      expect(first).toMatchObject({ next_cursor: '20' });
      expect(requests[1]!.query).toEqual({ page_size: '2', before: '30' });
    });

    it('offers no cursor when Figma links back to the page it just sent', async () => {
      answer = () => ({
        status: 200,
        body: {
          versions: [version('20')],
          pagination: { next_page: 'https://api.figma.com/v1/files/FILE/versions?before=20' },
        },
      });

      const result = await run('figma_list_versions', { file_key: 'FILE', cursor: '20' });

      expect(result).not.toHaveProperty('next_cursor');
    });

    it('finds a version on an older page', async () => {
      answer = request =>
        request.query.before === '20'
          ? { status: 200, body: { versions: [version('10')], pagination: {} } }
          : {
              status: 200,
              body: {
                versions: [version('30'), version('20')],
                pagination: { next_page: 'https://api.figma.com/v1/files/FILE/versions?before=20' },
              },
            };

      const result = await run('figma_get_version', { file_key: 'FILE', version_id: '10' });

      expect(result).toMatchObject({ id: '10' });
      expect(requests.map(request => request.query)).toEqual([{ page_size: '50' }, { page_size: '50', before: '20' }]);
    });

    it('stops looking when Figma keeps linking to the same page', async () => {
      answer = () => ({
        status: 200,
        body: {
          versions: [version('20')],
          pagination: { next_page: 'https://api.figma.com/v1/files/FILE/versions?before=20' },
        },
      });

      await expect(run('figma_get_version', { file_key: 'FILE', version_id: '999' })).rejects.toThrow(/not found/);
      expect(requests).toHaveLength(2);
    });

    it('gives up after 20 pages without calling an unsearched version missing', async () => {
      let page = 0;
      answer = () => {
        page++;
        return {
          status: 200,
          body: {
            versions: [version(String(10_000 - page))],
            pagination: { next_page: `https://api.figma.com/v1/files/FILE/versions?before=${10_000 - page}` },
          },
        };
      };

      const failure = await run('figma_get_version', { file_key: 'FILE', version_id: '1' }).then(
        () => undefined,
        (error: unknown) => error as Error,
      );

      expect(requests).toHaveLength(20);
      expect(failure).toBeInstanceOf(Error);
      expect(failure?.message).toMatch(/newest 1000 versions/);
      expect(failure?.message).toMatch(/figma_list_versions/);
      expect(failure?.message).not.toMatch(/not found/);
    });
  });

  describe('node ids', () => {
    const nodes = {
      name: 'Design',
      role: 'owner',
      lastModified: '2026-01-01T00:00:00Z',
      editorType: 'figma',
      thumbnailUrl: 'https://example.com/t.png',
      version: '1',
    };

    it('reads a node by the dash id in a Figma URL, with a component set that has no links', async () => {
      answer = () => ({
        status: 200,
        body: {
          ...nodes,
          nodes: {
            '91:1': {
              document: { id: '91:1', type: 'FRAME' },
              components: {},
              componentSets: { '2:1': { key: 'k', name: 'Button', description: '' } },
              schemaVersion: 0,
              styles: {},
            },
          },
        },
      });

      const result = await run('figma_get_file_node', { file_key: 'FILE', node_id: '91-1' });

      expect(requests[0]!.query).toEqual({ ids: '91:1' });
      expect(result).toMatchObject({ document: { id: '91:1' }, componentSets: { '2:1': { name: 'Button' } } });
    });

    it('sends colon ids when listing nodes and rendering images', async () => {
      answer = request =>
        request.path.startsWith('/v1/images/')
          ? { status: 200, body: { err: null, images: { '91:1': 'https://example.com/1.png' } } }
          : { status: 200, body: { ...nodes, nodes: { '91:1': null, '1:2': null } } };

      await run('figma_list_file_nodes', { file_key: 'FILE', ids: ['91-1', '1:2'] });
      await run('figma_render_images', { file_key: 'FILE', node_ids: ['91-1'] });

      expect(requests.map(request => request.query.ids)).toEqual(['91:1,1:2', '91:1']);
    });

    it('sends colon ids when pinning a comment and linking or listing dev resources', async () => {
      answer = request =>
        request.method === 'GET'
          ? { status: 200, body: { dev_resources: [] } }
          : request.path === '/v1/dev_resources'
            ? { status: 200, body: { links_created: [], errors: [] } }
            : { status: 200, body: comment() };

      await run('figma_create_comment', {
        file_key: 'FILE',
        message: 'Hi',
        node_id: '91-1',
        node_offset_x: 1,
        node_offset_y: 2,
      });
      await run('figma_create_dev_resources', {
        dev_resources: [{ name: 'Ticket', url: 'https://example.com/1', file_key: 'FILE', node_id: '91-1' }],
      });
      await run('figma_list_dev_resources', { file_key: 'FILE', node_ids: ['91-1', '1:2'] });

      expect(requests[0]!.body).toMatchObject({ client_meta: { node_id: '91:1' } });
      expect(requests[1]!.body).toEqual({
        dev_resources: [{ name: 'Ticket', url: 'https://example.com/1', file_key: 'FILE', node_id: '91:1' }],
      });
      expect(requests[2]!.query).toEqual({ node_ids: '91:1,1:2' });
    });
  });

  describe('libraries', () => {
    it.each([
      ['figma_get_file_components', 'components'],
      ['figma_get_file_component_sets', 'component_sets'],
    ])('%s reads an asset outside any frame', async (toolId, field) => {
      answer = () => ({
        status: 200,
        body: { status: 200, error: false, meta: { [field]: [{ ...published('loose'), containing_frame: {} }] } },
      });

      const result = await run(toolId, { file_key: 'FILE' });

      expect(JSON.stringify(result)).toContain('"loose"');
    });

    it('reads team component sets outside a state group and keeps component frame ids', async () => {
      answer = request =>
        request.path.endsWith('/component_sets')
          ? { status: 200, body: { status: 200, error: false, meta: { component_sets: [published('set')] } } }
          : { status: 200, body: { status: 200, error: false, meta: { components: [published('comp')] } } };

      const sets = (await run('figma_list_component_sets', { team_id: '1' })) as Record<string, unknown>;
      const components = (await run('figma_list_components', { team_id: '1' })) as Record<string, unknown>;

      expect(JSON.stringify(sets)).toContain('"pageId":"0:1"');
      expect(JSON.stringify(components)).toContain('"nodeId":"1:2"');
    });

    it('lists a team chosen in the input rather than in connection metadata', async () => {
      answer = () => ({ status: 200, body: { status: 200, error: false, meta: { styles: [] } } });

      await run('figma_list_styles', { team_id: '42', cursor: '7' });

      expect(requests).toEqual([expect.objectContaining({ path: '/v1/teams/42/styles', query: { after: '7' } })]);
      await expect(run('figma_list_styles', { team_id: '42', cursor: 'next' })).rejects.toThrow(/failed validation/);
    });

    it('does not report a refused component set as missing', async () => {
      answer = () => ({ status: 403, body: { status: 403, error: true, message: 'Invalid scope' } });

      const failure = await run('figma_get_component_set', { key: 'abc' }).catch((error: unknown) => error);

      expect(String((failure as Error).message)).not.toMatch(/Component set not found/);
    });
  });

  describe('dev resources', () => {
    it('reports updated links as ids and errors without an id', async () => {
      answer = () => ({
        status: 200,
        body: {
          links_updated: [{ id: 'dr_1', name: 'Ticket', url: 'https://example.com', file_key: 'FILE', node_id: '1:2' }],
          errors: [{ error: 'not found' }],
        },
      });

      const result = await run('figma_update_dev_resources', { dev_resources: [{ id: 'dr_1', name: 'Ticket' }] });

      expect(result).toEqual({ links_updated: ['dr_1'], errors: [{ error: 'not found' }] });
    });

    it('reads create errors that name no file or node', async () => {
      answer = () => ({ status: 200, body: { links_created: [], errors: [{ error: 'rate limited' }] } });

      const result = await run('figma_create_dev_resources', {
        dev_resources: [{ name: 'Ticket', url: 'https://example.com/1', file_key: 'FILE', node_id: '1:2' }],
      });

      expect(result).toEqual({ links_created: [], errors: [{ error: 'rate limited' }] });
    });
  });

  describe('variables', () => {
    it.each([
      ['a bound opacity', { color: { r: 1, g: 0, b: 0 }, opacity: { type: 'VARIABLE_ALIAS', id: 'VariableID:1:4' } }],
      ['a bound color', { color: { type: 'VARIABLE_ALIAS', id: 'VariableID:1:3' }, opacity: 50 }],
    ])('sets a composed color with %s', async (_case, value) => {
      answer = () => ({ status: 200, body: { status: 200, error: false, meta: { tempIdToRealId: {} } } });

      await run('figma_update_variables', {
        file_key: 'FILE',
        variableModeValues: [{ variableId: 'VariableID:1:2', modeId: '1:0', value }],
      });

      expect(requests[0]!.body).toMatchObject({ variableModeValues: [{ value }] });
    });

    it('refuses a composed color with nothing bound to a variable', async () => {
      await expect(
        run('figma_update_variables', {
          file_key: 'FILE',
          variableModeValues: [
            { variableId: 'VariableID:1:2', modeId: '1:0', value: { color: { r: 1, g: 0, b: 0 }, opacity: 50 } },
          ],
        }),
      ).rejects.toThrow(/failed validation/);
      expect(requests).toEqual([]);
    });
  });
});
