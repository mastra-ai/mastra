import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatIssueRef,
  formatMergeRequestRef,
  GitLabApiError,
  GitLabClient,
  parseIssueRef,
  parseIssueReference,
  parseMergeRequestReference,
} from './client.js';
import type { GitLabIssue, GitLabIssueRef, GitLabNote } from './client.js';

// ── fetch harness ────────────────────────────────────────────────────────
// Requests are captured so the tests can assert on the URL GitLab would have
// received (query params carry pagination and filtering semantics).
interface Captured {
  url: URL;
  method: string;
  headers: Headers;
  body: unknown;
}

let captured: Captured[] = [];
let respond: (request: Captured) => Response;

function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

beforeEach(() => {
  captured = [];
  respond = () => json({});
  vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
    const request: Captured = {
      url: input instanceof URL ? input : new URL(String(input)),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    captured.push(request);
    return respond(request);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function client(options: { baseUrl?: string; pageSize?: number } = {}): GitLabClient {
  return new GitLabClient({
    baseUrl: options.baseUrl ?? 'https://gitlab.com',
    accessToken: 'gl-token',
    ...(options.pageSize === undefined ? {} : { pageSize: options.pageSize }),
  });
}

const ref: GitLabIssueRef = { projectId: '42', iid: 7 };

function issue(overrides: Partial<GitLabIssue> = {}): GitLabIssue {
  return {
    id: 9001,
    iid: 7,
    project_id: 42,
    title: 'Fix intake sync',
    description: null,
    state: 'opened',
    web_url: 'https://gitlab.com/group/project/-/issues/7',
    author: { username: 'grace' },
    assignee: null,
    labels: [],
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-02T00:00:00Z',
    ...overrides,
  };
}

// ── issue ref codec ──────────────────────────────────────────────────────
describe('issue ref codec', () => {
  it('round-trips a ref through the stored external id', () => {
    expect(formatIssueRef(ref)).toBe('42!7');
    expect(parseIssueRef(formatIssueRef(ref))).toEqual(ref);
  });

  it('round-trips a path-style project id, which contains no separator', () => {
    const pathRef = { projectId: 'group/project', iid: 128 };
    expect(parseIssueRef(formatIssueRef(pathRef))).toEqual(pathRef);
  });

  it('parses the iid as a number so callers never build a URL from a string', () => {
    expect(parseIssueRef('42!7')?.iid).toBe(7);
  });

  it.each([
    ['', 'empty'],
    ['42', 'no separator'],
    ['42!', 'missing iid'],
    ['!7', 'missing project'],
    ['42!0', 'iid is not positive'],
    ['42!-3', 'iid is negative'],
    ['42!abc', 'iid is not numeric'],
    ['42!7.5', 'iid is fractional'],
    ['42!99999999999999999999', 'iid exceeds safe integer range'],
  ])('rejects %j (%s)', externalId => {
    // A null here surfaces as "not found" at the capability boundary rather
    // than as a request to a nonsense URL.
    expect(parseIssueRef(externalId)).toBeNull();
  });
});

// ── lenient reference parsing ────────────────────────────────────────────
// An agent types what a human would paste, not the stored `externalId`.
describe('lenient issue reference parsing', () => {
  it('accepts the canonical stored external id', () => {
    expect(parseIssueReference('42!7')).toEqual(ref);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseIssueReference('  42!7  ')).toEqual(ref);
  });

  it.each([
    'https://gitlab.com/acme/app/-/issues/7',
    'http://gitlab.example.com/acme/app/-/issues/7',
    'https://gitlab.com/acme/app/-/issues/7#note_3',
  ])('parses the issue URL %j', url => {
    // The path is URL-encoded because GitLab accepts an encoded path anywhere
    // it accepts a numeric project id.
    expect(parseIssueReference(url)).toEqual({ projectId: 'acme%2Fapp', iid: 7 });
  });

  it('keeps a nested subgroup path intact', () => {
    expect(parseIssueReference('https://gitlab.com/acme/team/app/-/issues/7')).toEqual({
      projectId: 'acme%2Fteam%2Fapp',
      iid: 7,
    });
  });

  it('parses the namespaced reference GitLab prints', () => {
    expect(parseIssueReference('acme/app#7')).toEqual({ projectId: 'acme%2Fapp', iid: 7 });
  });

  it.each([
    ['issue seven', 'prose'],
    ['#7', 'no project'],
    ['acme/app', 'no iid'],
    ['acme/app#0', 'iid is not positive'],
    ['https://gitlab.com/acme/app/-/merge_requests/7', 'a merge request, not an issue'],
    ['https://gitlab.com/acme/app/issues/7', 'missing the /-/ segment'],
  ])('rejects %j (%s)', input => {
    expect(parseIssueReference(input)).toBeNull();
  });
});

// ── request plumbing ─────────────────────────────────────────────────────
describe('request plumbing', () => {
  it('bearer-authenticates against the v4 API root', async () => {
    respond = () => json({ username: 'ada' });
    await expect(client().getCurrentUser()).resolves.toEqual({ username: 'ada' });
    expect(captured[0]?.url.toString()).toBe('https://gitlab.com/api/v4/user');
    expect(captured[0]?.headers.get('authorization')).toBe('Bearer gl-token');
  });

  it('strips a trailing slash from a self-hosted base url', async () => {
    respond = () => json({ version: '17.2.0', revision: 'abc' });
    await client({ baseUrl: 'https://git.internal.example.com/' }).getVersion();
    expect(captured[0]?.url.toString()).toBe('https://git.internal.example.com/api/v4/version');
  });

  it('surfaces the GitLab error message and status on failure', async () => {
    respond = () => json({ message: '403 Forbidden' }, { status: 403 });
    const error = await client()
      .getCurrentUser()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitLabApiError);
    expect((error as GitLabApiError).status).toBe(403);
    expect((error as GitLabApiError).message).toContain('403 Forbidden');
  });

  it('still throws with the status when a proxy answers a non-JSON body', async () => {
    respond = () => new Response('<html>502</html>', { status: 502, headers: { 'content-type': 'text/html' } });
    const error = await client()
      .getCurrentUser()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitLabApiError);
    expect((error as GitLabApiError).status).toBe(502);
  });
});

// ── listings and pagination ──────────────────────────────────────────────
describe('listProjects', () => {
  it('asks only for projects the token can act on', async () => {
    respond = () => json([]);
    await client().listProjects();
    const params = captured[0]!.url.searchParams;
    expect(captured[0]!.url.pathname).toBe('/api/v4/projects');
    expect(params.get('membership')).toBe('true');
    // 30 is Developer: below it the token cannot comment or close, so listing
    // the project as an intake source would offer an action that always fails.
    expect(params.get('min_access_level')).toBe('30');
  });
});

describe('listProjectIssues', () => {
  it('defaults to open issues ordered by recency', async () => {
    respond = () => json([issue()]);
    const page = await client().listProjectIssues({ projectId: '42' });
    const params = captured[0]!.url.searchParams;
    expect(params.get('state')).toBe('opened');
    expect(params.get('order_by')).toBe('updated_at');
    expect(params.get('labels')).toBeNull();
    expect(params.get('page')).toBeNull();
    expect(page.items).toHaveLength(1);
  });

  it('url-encodes a path-style project id into the path segment', async () => {
    respond = () => json([]);
    await client().listProjectIssues({ projectId: 'group/sub/project' });
    // GitLab requires the percent-encoded form; an unencoded slash would
    // resolve to a different (nonexistent) route.
    expect(captured[0]!.url.pathname).toBe('/api/v4/projects/group%2Fsub%2Fproject/issues');
  });

  it('comma-joins labels the way the GitLab filter expects', async () => {
    respond = () => json([]);
    await client().listProjectIssues({ projectId: '42', labels: ['bug', 'needs triage'] });
    expect(captured[0]!.url.searchParams.get('labels')).toBe('bug,needs triage');
  });

  it('carries the x-next-page header out as the contract cursor', async () => {
    respond = () => json([issue()], { headers: { 'x-next-page': '2' } });
    await expect(client().listProjectIssues({ projectId: '42' })).resolves.toMatchObject({ nextCursor: '2' });
  });

  it('reports no cursor on the last page, whether the header is empty or absent', async () => {
    respond = () => json([issue()], { headers: { 'x-next-page': '' } });
    await expect(client().listProjectIssues({ projectId: '42' })).resolves.toMatchObject({ nextCursor: null });

    respond = () => json([issue()]);
    await expect(client().listProjectIssues({ projectId: '42' })).resolves.toMatchObject({ nextCursor: null });
  });

  it('feeds a cursor back as the page number, honoring the configured page size', async () => {
    respond = () => json([]);
    await client({ pageSize: 50 }).listProjectIssues({ projectId: '42', cursor: '3' });
    expect(captured[0]!.url.searchParams.get('page')).toBe('3');
    expect(captured[0]!.url.searchParams.get('per_page')).toBe('50');
  });

  it('ignores a cursor that is not a usable page number', async () => {
    respond = () => json([]);
    for (const cursor of ['0', '-1', 'abc', '2.5']) {
      captured = [];
      await client().listProjectIssues({ projectId: '42', cursor });
      // Dropping the param restarts at page 1 instead of letting GitLab 400 on
      // a cursor that survived a round-trip through storage.
      expect(captured[0]!.url.searchParams.get('page')).toBeNull();
    }
  });
});

// ── single issue reads and writes ────────────────────────────────────────
describe('getIssue', () => {
  it('addresses the issue by project and iid', async () => {
    respond = () => json(issue());
    await expect(client().getIssue(ref)).resolves.toMatchObject({ iid: 7 });
    expect(captured[0]!.url.pathname).toBe('/api/v4/projects/42/issues/7');
  });

  it('reports a missing issue as null so a deleted card is not an outage', async () => {
    respond = () => json({ message: '404 Not found' }, { status: 404 });
    await expect(client().getIssue(ref)).resolves.toBeNull();
  });

  it('still throws on failures that are not a missing issue', async () => {
    respond = () => json({ message: '401 Unauthorized' }, { status: 401 });
    await expect(client().getIssue(ref)).rejects.toBeInstanceOf(GitLabApiError);
  });
});

describe('listIssueNotes', () => {
  it('drops system notes so only real discussion reaches the board', async () => {
    const notes: GitLabNote[] = [
      { id: 1, body: 'real comment', system: false, author: { username: 'ada' }, created_at: '2026-07-03T00:00:00Z' },
      { id: 2, body: 'changed the label', system: true, author: null, created_at: '2026-07-03T00:01:00Z' },
    ];
    respond = () => json(notes);
    await expect(client().listIssueNotes(ref)).resolves.toEqual([notes[0]]);
    expect(captured[0]!.url.searchParams.get('sort')).toBe('asc');
  });
});

describe('createIssueNote', () => {
  it('posts the comment body to the notes endpoint', async () => {
    respond = () => json({ id: 5, body: 'ack', system: false, author: null, created_at: '2026-07-03T00:00:00Z' });
    await client().createIssueNote(ref, 'ack');
    expect(captured[0]!.method).toBe('POST');
    expect(captured[0]!.url.pathname).toBe('/api/v4/projects/42/issues/7/notes');
    expect(captured[0]!.body).toEqual({ body: 'ack' });
    expect(captured[0]!.headers.get('content-type')).toBe('application/json');
  });
});

describe('setIssueState', () => {
  it.each(['close', 'reopen'] as const)('puts the %s state event on the issue', async event => {
    respond = () => json(issue({ state: event === 'close' ? 'closed' : 'opened' }));
    await client().setIssueState(ref, event);
    expect(captured[0]!.method).toBe('PUT');
    expect(captured[0]!.body).toEqual({ state_event: event });
  });
});

describe('parseMergeRequestReference', () => {
  it('round-trips the canonical ref', () => {
    expect(parseMergeRequestReference(formatMergeRequestRef({ projectId: '42', iid: 7 }))).toEqual({
      projectId: '42',
      iid: 7,
    });
  });

  it('reads a merge-request url', () => {
    expect(parseMergeRequestReference('https://gitlab.com/acme/widgets/-/merge_requests/7')).toEqual({
      projectId: 'acme%2Fwidgets',
      iid: 7,
    });
  });

  it("reads GitLab's own group/project!iid shorthand", () => {
    expect(parseMergeRequestReference('acme/widgets!7')).toEqual({ projectId: 'acme%2Fwidgets', iid: 7 });
  });

  it('does not mistake the canonical ref separator for the shorthand', () => {
    // `!` is both the ref separator and GitLab's MR sigil; a value with no
    // slash must stay a canonical project id, not become a path.
    expect(parseMergeRequestReference('42!7')).toEqual({ projectId: '42', iid: 7 });
  });

  it.each(['', 'acme/widgets!0', 'acme/widgets!-1', 'https://gitlab.com/acme/widgets/-/issues/7', 'nonsense'])(
    'rejects %o',
    value => {
      expect(parseMergeRequestReference(value)).toBeNull();
    },
  );
});

describe('merge requests', () => {
  const mrRef = { projectId: '42', iid: 7 };

  it('lists open merge requests by default, paginated', async () => {
    respond = () => json([], { headers: { 'x-next-page': '2' } });
    const page = await client().listMergeRequests({ projectId: '42' });
    expect(captured[0]!.url.pathname).toBe('/api/v4/projects/42/merge_requests');
    expect(captured[0]!.url.searchParams.get('state')).toBe('opened');
    expect(page.nextCursor).toBe('2');
  });

  it('returns null for a merge request that is absent', async () => {
    respond = () => json({ message: '404 Not found' }, { status: 404 });
    await expect(client().getMergeRequest(mrRef)).resolves.toBeNull();
  });

  it('propagates a non-404 failure rather than reporting absence', async () => {
    respond = () => json({ message: 'boom' }, { status: 500 });
    await expect(client().getMergeRequest(mrRef)).rejects.toBeInstanceOf(GitLabApiError);
  });

  it('preserves an explicit null description so a body can be cleared', async () => {
    respond = () => json({});
    await client().updateMergeRequest(mrRef, { description: null });
    expect(captured[0]!.body).toEqual({ description: null });
  });

  it('omits an absent description rather than clearing it', async () => {
    respond = () => json({});
    await client().updateMergeRequest(mrRef, { title: 'New title' });
    expect(captured[0]!.body).toEqual({ title: 'New title' });
  });

  it.each([405, 406, 409, 422])('reports a %i from the merge endpoint as a refusal', async status => {
    respond = () => json({ message: 'not mergeable' }, { status });
    const result = await client().acceptMergeRequest(mrRef);
    expect(result.mergeRequest).toBeNull();
    expect(result.refusal).toContain(String(status));
  });

  it('still throws when the merge endpoint fails for an infrastructure reason', async () => {
    respond = () => json({ message: 'boom' }, { status: 500 });
    await expect(client().acceptMergeRequest(mrRef)).rejects.toBeInstanceOf(GitLabApiError);
  });

  it('filters system notes out of merge-request discussion', async () => {
    respond = () =>
      json([
        { id: 1, body: 'real', system: false, author: null, created_at: 'T1' },
        { id: 2, body: 'assigned to @ada', system: true, author: null, created_at: 'T2' },
      ]);
    const page = await client().listMergeRequestNotes(mrRef);
    expect(page.items.map(note => note.id)).toEqual([1]);
  });

  it('sends a text position when creating an anchored discussion', async () => {
    respond = () => json({ id: 'd1', individual_note: false, notes: [] });
    await client().createMergeRequestDiscussion(mrRef, {
      body: 'anchored',
      position: { baseSha: 'b', headSha: 'h', startSha: 's', newPath: 'src/app.ts', newLine: 42 },
    });
    expect(captured[0]!.body).toEqual({
      body: 'anchored',
      position: {
        base_sha: 'b',
        head_sha: 'h',
        start_sha: 's',
        position_type: 'text',
        new_path: 'src/app.ts',
        old_path: 'src/app.ts',
        new_line: 42,
      },
    });
  });

  it('escapes a discussion id into the notes path', async () => {
    respond = () => json({ id: 3, body: 'reply', system: false, author: null, created_at: 'T1' });
    await client().addMergeRequestDiscussionNote(mrRef, 'abc/def', 'reply');
    expect(captured[0]!.url.pathname).toBe('/api/v4/projects/42/merge_requests/7/discussions/abc%2Fdef/notes');
  });

  it('looks a user up by username for reviewer assignment', async () => {
    respond = () => json([{ id: 77, username: 'grace' }]);
    await expect(client().findUserByUsername('grace')).resolves.toEqual({ id: 77, username: 'grace' });
    expect(captured[0]!.url.searchParams.get('username')).toBe('grace');
  });

  it('returns null when no user matches', async () => {
    respond = () => json([]);
    await expect(client().findUserByUsername('nobody')).resolves.toBeNull();
  });
});
