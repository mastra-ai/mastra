import type {
  RouteResponse,
  SearchSkillsResponse,
  SkillSearchResult,
  WorkspaceFsListResponse,
  WorkspaceFsReadResponse,
  WorkspaceSearchResponse,
} from '@mastra/client-js';
import { http, HttpResponse } from 'msw';

export const BASE_URL = 'http://localhost:4111';
export const WORKSPACE_ID = 'ws-1';
export const WORKSPACE_URL = `${BASE_URL}/api/workspaces/${WORKSPACE_ID}`;

export const rootListing: WorkspaceFsListResponse = {
  path: '.',
  entries: [
    { name: 'docs', type: 'directory' },
    { name: 'src', type: 'directory' },
    { name: 'README.md', type: 'file', size: 20 },
  ],
};

export const srcListing: WorkspaceFsListResponse = {
  path: 'src',
  entries: [{ name: 'index.ts', type: 'file', size: 18 }],
};

export const docsListing: WorkspaceFsListResponse = {
  path: 'docs',
  entries: [{ name: 'guides', type: 'directory' }],
};

export const guidesListing: WorkspaceFsListResponse = {
  path: 'docs/guides',
  entries: [{ name: 'intro.md', type: 'file', size: 12 }],
};

export const LOG_COUNT = 3_000;

export const logsListing: WorkspaceFsListResponse = {
  path: 'logs',
  entries: Array.from({ length: LOG_COUNT }, (_, i) => ({ name: `run-${i}.json`, type: 'file' })),
};

export const rootWithLogsListing: WorkspaceFsListResponse = {
  ...rootListing,
  entries: [{ name: 'logs', type: 'directory' }, ...rootListing.entries],
};

export const fileContents: Record<string, string> = {
  'README.md': '# Hello workspace',
  'docs/guides/intro.md': '# Intro',
  'docs/guides/images.md':
    '# Images\n\n![Logo](../../logo.png)\n\n![Badge](https://example.com/badge.svg)\n\n![Missing](./missing.png)',
  'src/index.ts': 'const answer = 42;',
  'skills/review/SKILL.md': '---\nname: review\ndescription: Reviews code\n---\n# Review skill',
  'logo.png': 'iVBORw0KGgo=',
  'cache/digest.json': '{"rows":[{"id":12345678901234567890,"2":1.0,"1":"a,b:{c} \\"q\\""}],"empty":{},"list":[ ]}',
  'cache/broken.json': '{"rows":[1,2',
  'cache/large.json': JSON.stringify({
    rows: Array.from({ length: 1_000 }, (_, i) => ({ id: `row-${i}`, text: 'shipped the change', ok: true })),
  }),
  'src/large.ts': Array.from({ length: 2_000 }, (_, i) => `export const value${i} = compute(${i}, "row ${i}");`).join(
    '\n',
  ),
  'cache/nested.json': `${'['.repeat(5000)}1${']'.repeat(5000)}`,
  'sfx/applause.wav': 'RIFF$\u00e2\u0004\u0000WAVEfmt \u0010\u0000\u0000\u0000\u0001\u0000',
};

const mimeTypes: Record<string, string> = { 'logo.png': 'image/png' };

export const readResponse = (path: string): WorkspaceFsReadResponse => ({
  path,
  content: fileContents[path] ?? '',
  type: 'file',
  mimeType: mimeTypes[path],
});

export const fileSearchResponse: WorkspaceSearchResponse = {
  query: 'hello',
  mode: 'bm25',
  results: [{ id: 'README.md#chunk-0', content: '# Hello workspace', score: 0.4 }],
};

/** The server also returns `skillPath`, which the client type does not declare yet. */
export const skillSearchResponse: SearchSkillsResponse = {
  query: 'hello',
  results: [
    {
      skillName: 'review',
      skillPath: 'skills/review',
      source: 'skills/review/SKILL.md',
      content: '# Review skill',
      score: 0.9,
    } as SkillSearchResult,
  ],
};

export const listHandler = (listings: Record<string, WorkspaceFsListResponse>) =>
  http.get(`${WORKSPACE_URL}/fs/list`, ({ request }) => {
    const path = new URL(request.url).searchParams.get('path') ?? '.';
    const listing = listings[path];
    return listing ? HttpResponse.json(listing) : HttpResponse.json({ error: 'not found' }, { status: 404 });
  });

export const readHandler = () =>
  http.get(`${WORKSPACE_URL}/fs/read`, ({ request }) => {
    const path = new URL(request.url).searchParams.get('path') ?? '';
    return path in fileContents
      ? HttpResponse.json(readResponse(path))
      : HttpResponse.json({ error: 'not found' }, { status: 404 });
  });

export const mountedRootListing: WorkspaceFsListResponse = {
  path: '.',
  entries: [
    {
      name: 'data',
      type: 'directory',
      mount: { provider: 's3', displayName: 'Data bucket', description: 'Raw exports' },
    },
    { name: 'broken', type: 'directory', mount: { provider: 'gcs', status: 'error', error: 'Bucket not found' } },
    { name: 'src', type: 'directory' },
  ],
};

export const popularSkills: RouteResponse<'GET /workspaces/:workspaceId/skills-sh/popular'> = {
  skills: [{ id: 'acme/skills/pdf', name: 'pdf', installs: 42, topSource: 'acme/skills' }],
  count: 1,
  limit: 10,
  offset: 0,
};

export const skillPreview: RouteResponse<'GET /workspaces/:workspaceId/skills-sh/preview'> = {
  content: '# PDF skill',
};

export const skillsShHandlers = [
  http.get(`${WORKSPACE_URL}/skills-sh/popular`, () => HttpResponse.json(popularSkills)),
  http.get(`${WORKSPACE_URL}/skills-sh/preview`, () => HttpResponse.json(skillPreview)),
];
