import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { RequestContext } from '@mastra/core/request-context';
import { isValidationError } from '@mastra/core/tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z as z4 } from 'zod';
import { z as z3 } from 'zod/v3';

import { GITLAB_ID_OR_PATH_SCHEMA } from '../../scripts/generate-provider.js';

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
  let answer: (target: string) => { status: number; body: unknown; headers?: Record<string, string> };

  beforeAll(async () => {
    server = createServer((request, response) => {
      const target = request.url ?? '/';
      const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
        response.writeHead(status, { 'content-type': 'application/json', ...headers });
        response.end(body === undefined ? '' : JSON.stringify(body));
      };
      if (target.endsWith('/connections')) return send(200, { connections: [connection] });
      if (target.endsWith('/integrations')) return send(200, { integrations: [integration] });
      if (!target.startsWith(PROXY_PREFIX)) return send(404, { error: `unexpected request ${target}` });
      const proxied = target.slice(PROXY_PREFIX.length);
      requests.push({ method: request.method, target: proxied });
      const { status, body, headers } = answer(proxied);
      send(status, body, headers);
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
      providers: { gitlab: { connectionId: connection.id } },
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

  /** Runs a tool expecting input validation to refuse it before anything reaches GitLab. */
  async function expectRefused(toolId: string, input: Record<string, unknown>) {
    await expect(run(toolId, input)).rejects.toThrow(`${toolId} failed validation`);
    expect(requests).toEqual([]);
  }

  const issue = {
    iid: 3,
    title: 'Bug',
    description: null,
    state: 'opened',
    labels: [],
    assignees: [],
    milestone: null,
    due_date: null,
    confidential: false,
    discussion_locked: null,
    issue_type: 'issue',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    web_url: 'https://gitlab.example/team/app/-/issues/3',
    project_id: 42,
  };

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

      expect(requests).toEqual([
        { method: 'GET', target: '/api/v4/projects/team%2Fapp/releases/v1.0.0' },
        { method: 'DELETE', target: '/api/v4/projects/team%2Fapp/releases/v1.0.0' },
      ]);
    });

    it('keeps a literal percent sequence in a branch name distinct from a slash', async () => {
      answer = () => ({ status: 404, body: { message: '404 Branch Not Found' } });

      await expect(run('gitlab_get_branch', { project_id: 42, branch: 'release%2Fnext' })).rejects.toThrow();
      await expect(run('gitlab_get_branch', { project_id: 42, branch: 'release/next' })).rejects.toThrow();

      expect(requests.map(request => request.target)).toEqual([
        '/api/v4/projects/42/repository/branches/release%252Fnext',
        '/api/v4/projects/42/repository/branches/release%2Fnext',
      ]);
    });

    it('deletes the release for a tag with a literal percent sequence, not the decoded tag', async () => {
      answer = () => ({ status: 200, body: { tag_name: 'v1%41', description: 'notes' } });

      const result = await run('gitlab_delete_release', { project_id: 42, tag_name: 'v1%41' });

      expect(result).toMatchObject({ tag_name: 'v1%41', deleted: true });
      // Decoded first, `v1%41` would have deleted the release for tag `v1A`.
      expect(requests).toEqual([{ method: 'DELETE', target: '/api/v4/projects/42/releases/v1%2541' }]);
    });

    it('creates and reads back a file whose name contains a literal percent sequence', async () => {
      answer = () => ({ status: 201, body: { file_path: 'docs/a%20b.txt', branch: 'main' } });

      const created = await run('gitlab_create_file', {
        project_id: 42,
        file_path: 'docs/a%20b.txt',
        branch: 'main',
        content: 'x',
        commit_message: 'add',
      });
      answer = () => ({
        status: 200,
        body: {
          file_name: 'a%20b.txt',
          file_path: 'docs/a%20b.txt',
          size: 1,
          encoding: 'base64',
          content: 'eA==',
          content_sha256: 'sha',
          ref: 'main',
          blob_id: 'blob',
          commit_id: 'c1',
          last_commit_id: 'c1',
          execute_filemode: false,
        },
      });
      await run('gitlab_get_file', { project_id: 42, file_path: created.file_path, ref: 'main' });

      // `docs/a b.txt` would be `docs%2Fa%20b.txt`; the literal `%20` must stay distinct.
      expect(requests).toEqual([
        { method: 'POST', target: '/api/v4/projects/42/repository/files/docs%2Fa%2520b.txt' },
        { method: 'GET', target: '/api/v4/projects/42/repository/files/docs%2Fa%2520b.txt?ref=main' },
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

  describe('project ids', () => {
    it('accepts the numeric project id other tools return when deleting a pipeline', async () => {
      const result = await run('gitlab_delete_pipeline', { project_id: 42, pipeline_id: 7 });

      expect(result).toMatchObject({ project_id: '42' });
      expect(requests[0]?.target).toBe('/api/v4/projects/42/pipelines/7');
    });

    it('accepts the project path list_jobs takes when reading a job', async () => {
      answer = () => ({
        status: 200,
        body: { id: 9, name: 'rspec', status: 'pending', stage: 'test', ref: 'main', tag: false, allow_failure: false },
      });

      await run('gitlab_get_job', { project_id: 'team/app', job_id: 9 });

      expect(requests[0]?.target).toBe('/api/v4/projects/team%2Fapp/jobs/9');
    });
  });

  describe('request shape', () => {
    it('sends several job statuses as a GitLab array', async () => {
      answer = () => ({ status: 200, body: [] });

      await run('gitlab_list_jobs', { project_id: 42, scope: ['pending', 'running'] });

      expect(requests[0]?.target).toBe('/api/v4/projects/42/jobs?scope%5B%5D=pending&scope%5B%5D=running');
    });

    it('reads group metadata without the embedded project lists', async () => {
      answer = () => ({ status: 200, body: { id: 5, name: 'team', path: 'team' } });

      await run('gitlab_get_group', { id: 5 });

      expect(requests[0]?.target).toBe('/api/v4/groups/5?with_projects=false');
    });
  });

  describe('retries', () => {
    it('does not replay a branch delete after a transient 5xx', async () => {
      answer = () => ({ status: 502, body: { message: 'bad gateway' } });

      await expect(run('gitlab_delete_branch', { project_id: 42, branch: 'feature' })).rejects.toThrow();

      expect(requests).toEqual([{ method: 'DELETE', target: '/api/v4/projects/42/repository/branches/feature' }]);
    });

    it('does not replay a file update after a transient 5xx', async () => {
      answer = () => ({ status: 502, body: { message: 'bad gateway' } });

      await expect(
        run('gitlab_update_file', {
          project_id: 42,
          file_path: 'a.txt',
          branch: 'main',
          content: 'x',
          commit_message: 'update',
        }),
      ).rejects.toThrow();

      expect(requests).toEqual([{ method: 'PUT', target: '/api/v4/projects/42/repository/files/a.txt' }]);
    });

    it('still retries reads after a transient 5xx', async () => {
      answer = () => ({ status: 502, body: { message: 'bad gateway' } });

      await expect(run('gitlab_get_branch', { project_id: 42, branch: 'feature' })).rejects.toThrow();

      // get_branch asks the proxy for three attempts; writes ask for one.
      expect(requests).toEqual(
        Array.from({ length: 3 }, () => ({ method: 'GET', target: '/api/v4/projects/42/repository/branches/feature' })),
      );
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
      expect(result).not.toHaveProperty('runners_token');
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

      expect(release).toMatchObject({
        tag_name: 'v1.0.0',
        description: null,
        milestones: [{ id: 1, description: null, due_date: null, start_date: null }],
      });
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
  // Generated tools run on whichever zod the app installs (the package
  // supports 3 and 4), but the tests above only ever run zod 4, so build the
  // emitted id schema against both.
  describe.each([
    ['zod 3', z3],
    ['zod 4', z4],
  ])('generated id schema on %s', (_version, z) => {
    const idOrPath = new Function('z', `return ${GITLAB_ID_OR_PATH_SCHEMA}`)(z) as {
      safeParse(value: unknown): { success: boolean };
    };

    it.each([42, 'team/app', 'team%2Fapp', Number.MAX_SAFE_INTEGER])('accepts %s', value => {
      expect(idOrPath.safeParse(value).success).toBe(true);
    });

    it.each([Number.MAX_SAFE_INTEGER + 2, 0, 1.5, '', 'team/\ud800'])('refuses %s', value => {
      expect(idOrPath.safeParse(value).success).toBe(false);
    });
  });

  describe('input rules', () => {
    it('refuses a project id too large to send exactly', async () => {
      await expectRefused('gitlab_delete_file', {
        project_id: Number.MAX_SAFE_INTEGER + 2,
        file_path: 'a.txt',
        branch: 'main',
        commit_message: 'remove',
      });
    });

    it('refuses a project path that cannot be URL-encoded', async () => {
      await expectRefused('gitlab_list_jobs', { project_id: 'team/\ud800' });
    });

    it('refuses a project update that changes nothing', async () => {
      await expectRefused('gitlab_update_project', { id: 42 });
    });

    it('sends a project update that only turns shared runners off', async () => {
      answer = () => ({ status: 200, body: { id: 42, name: 'app', path: 'app', default_branch: null } });

      const result = await run('gitlab_update_project', { id: 42, shared_runners_enabled: false });

      // GitLab answers null for a project with no commits yet; the tool reports it as absent.
      expect(result).toMatchObject({ id: 42, name: 'app' });
      expect(result).not.toHaveProperty('default_branch');
      expect(requests).toEqual([{ method: 'PUT', target: '/api/v4/projects/42' }]);
    });

    it('refuses an issue update that changes nothing', async () => {
      await expectRefused('gitlab_update_issue', { project_id: 42, issue_iid: 3 });
    });

    it('sends an issue update that only clears confidentiality', async () => {
      answer = () => ({ status: 200, body: issue });

      await run('gitlab_update_issue', { project_id: 42, issue_iid: 3, confidential: false });

      expect(requests).toEqual([{ method: 'PUT', target: '/api/v4/projects/42/issues/3' }]);
    });

    it('refuses a negative two-factor grace period', async () => {
      await expectRefused('gitlab_update_group', { id: 5, two_factor_grace_period: -1 });
    });

    it('refuses a commit that creates a file without content', async () => {
      await expectRefused('gitlab_create_commit', {
        project_id: 42,
        branch: 'main',
        commit_message: 'add',
        actions: [{ action: 'create', file_path: 'a.txt' }],
      });
    });

    it('refuses a release with two asset links of the same name', async () => {
      await expectRefused('gitlab_create_release', {
        project_id: 42,
        tag_name: 'v1',
        assets_links: [
          { name: 'binary', url: 'https://example.com/a' },
          { name: 'binary', url: 'https://example.com/b' },
        ],
      });
    });

    it('refuses a merge request update naming the milestone two ways', async () => {
      await expectRefused('gitlab_update_merge_request', {
        project_id: 42,
        merge_request_iid: 1,
        milestone_id: 7,
        milestone: 'v1',
      });
    });

    it('refuses a list cursor that is not a page number', async () => {
      await expectRefused('gitlab_list_issues', { project_id: 42, cursor: 'next' });
    });
  });

  describe('pagination', () => {
    it('reads the next page from the Link header when GitLab omits x-next-page', async () => {
      answer = () => ({
        status: 200,
        body: [],
        headers: { link: '<https://gitlab.com/api/v4/projects/42/issues?page=3&per_page=20>; rel="next"' },
      });

      const result = await run('gitlab_list_issues', { project_id: 42, cursor: '2' });

      expect(result.next_cursor).toBe('3');
      expect(requests[0]?.target).toBe('/api/v4/projects/42/issues?page=2');
    });

    it('reports no next page when GitLab sends neither header', async () => {
      answer = () => ({ status: 200, body: [] });

      const result = await run('gitlab_list_issues', { project_id: 42 });

      expect(result.next_cursor).toBeUndefined();
    });
  });

  describe('missing branches', () => {
    it('reports a missing connection as such, not as a missing branch', async () => {
      answer = () => ({
        status: 404,
        body: { title: 'Not Found', status: 404, detail: 'connection gl_test not found' },
        headers: { 'content-type': 'application/problem+json' },
      });

      await expect(run('gitlab_get_branch', { project_id: 42, branch: 'main' })).rejects.toMatchObject({
        code: 'connection_not_found',
      });
    });

    it('reports a branch GitLab does not have as not found', async () => {
      answer = () => ({ status: 404, body: { message: '404 Branch Not Found' } });

      await expect(run('gitlab_get_branch', { project_id: 42, branch: 'gone' })).rejects.toThrow('Branch not found');
    });
  });
});
