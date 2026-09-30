import type {
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
  path: '/',
  entries: [
    { name: 'docs', type: 'directory' },
    { name: 'src', type: 'directory' },
    { name: 'README.md', type: 'file', size: 20 },
  ],
};

export const srcListing: WorkspaceFsListResponse = {
  path: '/src',
  entries: [{ name: 'index.ts', type: 'file', size: 18 }],
};

export const fileContents: Record<string, string> = {
  '/README.md': '# Hello workspace',
  '/src/index.ts': 'const answer = 42;',
  '/skills/review/SKILL.md': '# Review skill',
};

export const readResponse = (path: string): WorkspaceFsReadResponse => ({
  path,
  content: fileContents[path] ?? '',
  type: 'file',
});

export const fileSearchResponse: WorkspaceSearchResponse = {
  query: 'hello',
  mode: 'bm25',
  results: [{ id: '/README.md#chunk-0', content: '# Hello workspace', score: 0.4 }],
};

/** The server also returns `skillPath`, which the client type does not declare yet. */
export const skillSearchResponse: SearchSkillsResponse = {
  query: 'hello',
  results: [
    {
      skillName: 'review',
      skillPath: '/skills/review',
      source: '/skills/review/SKILL.md',
      content: '# Review skill',
      score: 0.9,
    } as SkillSearchResult,
  ],
};

export const listHandler = (listings: Record<string, WorkspaceFsListResponse>) =>
  http.get(`${WORKSPACE_URL}/fs/list`, ({ request }) => {
    const path = new URL(request.url).searchParams.get('path') ?? '/';
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
