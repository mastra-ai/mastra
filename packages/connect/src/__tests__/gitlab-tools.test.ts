import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { RequestContext } from '@mastra/core/request-context';
import { isValidationError } from '@mastra/core/tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { tools } from '../tools.js';

// The generated GitLab tools run through the public `tools()` resolver against
// a real HTTP server standing in for the Mastra platform; only GitLab's answers
// are scripted. These cover the generator's GitLab overrides: every path
// segment reaches GitLab encoded exactly once, the runner registration token
// never leaves a project result, and responses GitLab sends with `null` fields
// don't fail validation after GitLab has answered.

const connection = {
  id: 'gl_test',
  integrationId: 'gitlab',
  status: 'active',
  connectedByUserId: 'user_1',
  connectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  accountLabel: 'test',
  displayName: null,
  resourceId: null,
};

const integration = {
  id: 'gitlab',
  provider: 'gitlab',
  displayName: 'GitLab',
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
  /** Raw request target after the proxy prefix, exactly as it crossed the wire. */
  target: string;
}

describe('generated GitLab tools', () => {
  let server: Server;
  let baseUrl: string;
  let requests: RecordedRequest[];
  let answer: (target: string) => { status: number; body: unknown };

  beforeAll(async () => {
    server = createServer((request, response) => {
      const target = request.url ?? '/';
      const send = (status: number, body: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(body === undefined ? '' : JSON.stringify(body));
      };
      if (target.endsWith('/connections')) return send(200, { connections: [connection] });
      if (target.endsWith('/integrations')) return send(200, { integrations: [integration] });
      if (!target.startsWith(PROXY_PREFIX)) return send(404, { error: `unexpected request ${target}` });
      const proxied = target.slice(PROXY_PREFIX.length);
      requests.push({ method: request.method, target: proxied });
      const { status, body } = answer(proxied);
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

  async function run(toolId: string, input: Record<string, unknown>) {
    const resolved = await tools({
      providers: ['gitlab'],
      allowTools: [toolId],
      projectId: 'proj_test',
      client: { accessToken: 'test-platform-token', baseUrl },
    })();
    const tool = resolved[toolId] as
      | { execute?: (input: unknown, context: { requestContext: RequestContext }) => Promise<unknown> }
      | undefined;
    if (!tool?.execute) throw new Error(`${toolId} was not resolved`);
    const result = await tool.execute(input, { requestContext: new RequestContext() });
    if (isValidationError(result)) throw new Error(`${toolId} failed validation: ${result.message}`);
    return result as Record<string, unknown>;
  }

  describe('path segments', () => {
    it('keeps a query character in project_id inside the project segment of a pipeline delete', async () => {
      await run('gitlab_delete_pipeline', { project_id: '42?', pipeline_id: 7 });

      // Unencoded, the `?` would have sent `DELETE /api/v4/projects/42`: a project delete.
      expect(requests).toEqual([{ method: 'DELETE', target: '/api/v4/projects/42%3F/pipelines/7' }]);
    });

    it('keeps deletion options in group_id out of the query string', async () => {
      await run('gitlab_delete_group', { group_id: '5?permanently_remove=true&full_path=team' });

      expect(requests).toEqual([
        { method: 'DELETE', target: '/api/v4/groups/5%3Fpermanently_remove%3Dtrue%26full_path%3Dteam' },
      ]);
    });

    it.each([
      ['a raw path', 'team/app'],
      ['an encoded path', 'team%2Fapp'],
    ])('sends %s as one encoded project segment', async (_label, projectId) => {
      answer = () => ({ status: 200, body: { tag_name: 'v1.0.0', description: 'notes' } });

      await run('gitlab_get_release', { project_id: projectId, tag_name: 'v1.0.0' });
      await run('gitlab_delete_release', { project_id: projectId, tag_name: 'v1.0.0' });

      expect(requests.map(request => request.target)).toEqual([
        '/api/v4/projects/team%2Fapp/releases/v1.0.0',
        '/api/v4/projects/team%2Fapp/releases/v1.0.0',
      ]);
    });

    it('sends a nested file path from create_file as one segment when reading the file back', async () => {
      answer = () => ({
        status: 200,
        body: {
          file_name: 'app.ts',
          file_path: 'src/app.ts',
          size: 3,
          encoding: 'base64',
          content: 'YWJj',
          content_sha256: 'sha',
          ref: 'main',
          blob_id: 'blob',
          commit_id: 'c1',
          last_commit_id: 'c1',
          execute_filemode: false,
        },
      });

      const file = await run('gitlab_get_file', { project_id: 42, file_path: 'src/app.ts', ref: 'main' });

      expect(file.file_path).toBe('src/app.ts');
      expect(requests[0]?.target).toBe('/api/v4/projects/42/repository/files/src%2Fapp.ts?ref=main');
    });
  });

  describe('runner registration token', () => {
    const project = {
      id: 42,
      name: 'app',
      path: 'app',
      path_with_namespace: 'team/app',
      runners_token: 'GR1348941secret',
    };

    it('drops runners_token from get_project', async () => {
      answer = () => ({ status: 200, body: project });

      const result = await run('gitlab_get_project', { project_id: 42 });

      expect(result).toMatchObject({ id: 42, name: 'app' });
      expect(result).not.toHaveProperty('runners_token');
      expect(JSON.stringify(result)).not.toContain('GR1348941secret');
    });

    it('drops runners_token from create_project', async () => {
      answer = () => ({ status: 201, body: project });

      const result = await run('gitlab_create_project', { name: 'app' });

      expect(result).toMatchObject({ id: 42, name: 'app' });
      expect(JSON.stringify(result)).not.toContain('GR1348941secret');
    });
  });

  describe('null fields GitLab returns', () => {
    it('reads a commit that has no pipeline', async () => {
      answer = () => ({
        status: 200,
        body: {
          id: 'abc123',
          short_id: 'abc',
          title: 'docs [skip ci]',
          author_name: 'a',
          author_email: 'a@example.com',
          committer_name: 'a',
          committer_email: 'a@example.com',
          created_at: '2026-01-01T00:00:00Z',
          message: 'docs [skip ci]',
          committed_date: '2026-01-01T00:00:00Z',
          authored_date: '2026-01-01T00:00:00Z',
          parent_ids: [],
          last_pipeline: null,
          stats: { additions: 1, deletions: 0, total: 1 },
          status: null,
          web_url: 'https://gitlab.com/team/app/-/commit/abc123',
        },
      });

      const commit = await run('gitlab_get_commit', { project_id: 42, sha: 'abc123' });

      expect(commit).toMatchObject({ id: 'abc123', last_pipeline: null, status: null });
    });

    it('reads a release created without a description and with an undated milestone', async () => {
      answer = () => ({
        status: 200,
        body: {
          tag_name: 'v1.0.0',
          description: null,
          milestones: [{ id: 1, title: 'M1', description: null, due_date: null, start_date: null }],
        },
      });

      const release = await run('gitlab_get_release', { project_id: 42, tag_name: 'v1.0.0' });

      expect(release).toMatchObject({ tag_name: 'v1.0.0', description: null });
    });

    it('reads a merge request GitLab has not prepared yet', async () => {
      answer = () => ({
        status: 200,
        body: {
          id: 1,
          iid: 3,
          project_id: 42,
          title: 'MR',
          state: 'opened',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          target_branch: 'main',
          source_branch: 'feature',
          author: { id: 1, name: 'a', username: 'a', state: 'active', avatar_url: null, web_url: 'https://x' },
          source_project_id: 42,
          target_project_id: 42,
          upvotes: 0,
          downvotes: 0,
          user_notes_count: 0,
          references: { short: '!3', relative: '!3', full: 'team/app!3' },
          time_stats: { time_estimate: 0, total_time_spent: 0 },
          task_completion_status: { count: 0, completed_count: 0 },
          labels: [],
          draft: false,
          work_in_progress: false,
          merge_when_pipeline_succeeds: false,
          merge_status: 'checking',
          detailed_merge_status: 'preparing',
          sha: null,
          prepared_at: null,
          web_url: 'https://gitlab.com/team/app/-/merge_requests/3',
        },
      });

      const mr = await run('gitlab_get_merge_request', { project_id: 42, merge_request_iid: 3 });

      expect(mr).toMatchObject({ iid: 3, sha: null, prepared_at: null });
    });

    it('returns the queued job when GitLab retries it with no user', async () => {
      answer = () => ({
        status: 201,
        body: {
          id: 9,
          status: 'pending',
          stage: 'test',
          name: 'rspec',
          ref: 'main',
          tag: false,
          created_at: '2026-01-01T00:00:00Z',
          user: null,
          web_url: 'https://gitlab.com/team/app/-/jobs/9',
        },
      });

      const job = await run('gitlab_retry_job', { project_id: 42, job_id: 8 });

      expect(job).toMatchObject({ id: 9, status: 'pending', user: null });
    });

    it('returns a cancelled pipeline that reports coverage as a decimal string', async () => {
      answer = () => ({ status: 200, body: { id: 7, iid: 2, project_id: 42, status: 'success', coverage: '87.50' } });

      const pipeline = await run('gitlab_cancel_pipeline', { project_id: 42, pipeline_id: 7 });

      expect(pipeline).toMatchObject({ id: 7, coverage: '87.50' });
    });
  });
});
