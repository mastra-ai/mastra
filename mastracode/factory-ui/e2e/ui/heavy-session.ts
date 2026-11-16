import type { ProjectListRepository } from '@mastra/factory/routes/contracts';
import type { WorkItemRow } from '@mastra/factory/storage/domains/work-items/work-item-schema';
import { http, HttpResponse } from 'msw';

import type {
  WorkspaceChange,
  WorkspaceChangePatches,
  WorkspaceChanges,
  WorkspaceChangesRepository,
  WorkspaceChangeStatus,
  WorkspaceFile,
  WorkspaceFileIndex,
  WorkspaceTreeEntry,
  VoiceSettingsResponse,
} from '../../src/api/types';
import type { PullRequestSubscription } from '../../src/ui/domains/factory/services/githubSubscriptions';
import { listedRepository } from './factory-projects';

export const HEAVY = {
  factoryId: 'fp-1',
  sessionId: 'sess-heavy',
  threadId: 'thread-heavy',
  branch: 'factory/fac-1284-unify-the-workspace-panel-tabs-and-make-every-checkout-searchable-by-file-name',
  repositoryId: 'repo-mastra',
} as const;

const NOW = Date.parse('2026-11-13T18:00:00.000Z');
const ISO = (offsetHours: number) => new Date(NOW + offsetHours * 3_600_000).toISOString();

const REPOSITORIES: { id: string; slug: string; prefix: string }[] = [
  { id: HEAVY.repositoryId, slug: 'mastra-ai/mastra', prefix: 'mastra/' },
  { id: 'repo-docs', slug: 'mastra-ai/docs', prefix: 'docs/' },
  { id: 'repo-infra', slug: 'mastra-ai/infra', prefix: 'infra/' },
];

function repositoryFiles(): string[] {
  const packages = ['core', 'memory', 'rag', 'evals', 'deployer', 'cli', 'server', 'loggers', 'mcp', 'playground-ui'];
  const modules = ['agent', 'workflows', 'tools', 'storage', 'stream', 'processors', 'telemetry', 'utils'];
  const files = ['index.ts', 'types.ts', 'schema.ts', 'runner.ts', 'registry.ts', 'errors.ts'];
  const mastra = packages.flatMap(pkg => [
    `mastra/packages/${pkg}/package.json`,
    `mastra/packages/${pkg}/README.md`,
    `mastra/packages/${pkg}/CHANGELOG.md`,
    `mastra/packages/${pkg}/tsconfig.json`,
    ...modules.flatMap(module =>
      files.flatMap(file => [
        `mastra/packages/${pkg}/src/${module}/${file}`,
        `mastra/packages/${pkg}/src/${module}/${file.replace('.ts', '.test.ts')}`,
      ]),
    ),
  ]);
  const sections = ['getting-started', 'agents', 'workflows', 'memory', 'rag', 'evals', 'deployment', 'reference'];
  const docs = sections.flatMap(section =>
    Array.from(
      { length: 24 },
      (_, i) => `docs/src/content/en/docs/${section}/page-${String(i + 1).padStart(2, '0')}.mdx`,
    ),
  );
  const modulesInfra = ['network', 'database', 'sandbox-pool', 'observability', 'edge', 'secrets'];
  const infra = modulesInfra.flatMap(module =>
    ['main.tf', 'variables.tf', 'outputs.tf', 'README.md'].map(file => `infra/terraform/modules/${module}/${file}`),
  );
  return [
    ...mastra,
    'mastra/.github/workflows/ci.yml',
    'mastra/.github/workflows/release.yml',
    'mastra/.changeset/factory-session-stage-bar.md',
    'mastra/.gitignore',
    'mastra/package.json',
    'mastra/pnpm-workspace.yaml',
    'mastra/README.md',
    ...docs,
    'docs/package.json',
    'docs/README.md',
    ...infra,
    'infra/README.md',
    'mastra/packages/core/src/agent/agent-runner.ts',
    'mastra/packages/playground-ui/src/assets/logo.png',
  ];
}

const FILES = repositoryFiles();

const STATUSES: WorkspaceChangeStatus[] = ['modified', 'modified', 'modified', 'added', 'untracked', 'deleted'];

function changedFiles(): WorkspaceChange[] {
  const explicit = ['pnpm-workspace.yaml', 'agent-runner.ts', 'logo.png'];
  const picked = FILES.filter((path, i) => i % 23 === 0 && !explicit.some(name => path.endsWith(name))).slice(0, 136);
  const changes = picked.map((path, i): WorkspaceChange => {
    const status = STATUSES[i % STATUSES.length];
    return {
      path,
      status,
      additions: status === 'deleted' ? 0 : 3 + ((i * 7) % 90),
      deletions: status === 'added' || status === 'untracked' ? 0 : (i * 5) % 40,
    };
  });
  changes.push(
    {
      path: 'mastra/packages/core/src/agent/agent-runner.ts',
      previousPath: 'mastra/packages/core/src/agent/runner.ts',
      status: 'renamed',
      additions: 12,
      deletions: 4,
    },
    { path: 'mastra/pnpm-workspace.yaml', status: 'conflicted', additions: 2, deletions: 2 },
    { path: 'mastra/packages/playground-ui/src/assets/logo.png', status: 'added', binary: true },
  );
  return changes;
}

const CHANGES = changedFiles();

function withinRepository(path: string) {
  const repository = REPOSITORIES.find(candidate => path.startsWith(candidate.prefix));
  if (!repository) throw new Error(`No fixture repository holds ${path}`);
  return repository;
}

function totals(changes: readonly WorkspaceChange[]) {
  return {
    additions: changes.reduce((sum, change) => sum + (change.additions ?? 0), 0),
    deletions: changes.reduce((sum, change) => sum + (change.deletions ?? 0), 0),
  };
}

function workspaceChanges(): WorkspaceChanges {
  const repositories: WorkspaceChangesRepository[] = REPOSITORIES.map(repository => {
    const changes = CHANGES.filter(change => change.path.startsWith(repository.prefix));
    return { slug: repository.slug, prefix: repository.prefix, available: true, changes, ...totals(changes) };
  });
  return { workspacePath: HEAVY.sessionId, available: true, changes: CHANGES, ...totals(CHANGES), repositories };
}

function patchFor(change: WorkspaceChange, index: number): string {
  const path = change.path.slice(withinRepository(change.path).prefix.length);
  const header = `diff --git a/${path} b/${path}\nindex 1234567..abcdef${index % 10} 100644\n`;
  const added = Array.from(
    { length: Math.min(change.additions ?? 0, 12) },
    (_, i) => `+export const added${i} = ${i};`,
  );
  const removed = Array.from(
    { length: Math.min(change.deletions ?? 0, 6) },
    (_, i) => `-export const removed${i} = ${i};`,
  );
  if (change.status === 'added' || change.status === 'untracked') {
    return `${header.replace(/index .*\n/, 'new file mode 100644\n')}--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${added.length} @@\n${added.join('\n')}\n`;
  }
  if (change.status === 'deleted') {
    const gone = Array.from({ length: 8 }, (_, i) => `-export const gone${i} = ${i};`);
    return `${header.replace(/index .*\n/, 'deleted file mode 100644\n')}--- a/${path}\n+++ /dev/null\n@@ -1,8 +0,0 @@\n${gone.join('\n')}\n`;
  }
  const context = [' import { Agent } from "@mastra/core/agent";', ' ', ' export function setup() {'];
  const hunk = [...context, ...removed, ...added, '   return true;', ' }'];
  const oldLines = context.length + removed.length + 2;
  const newLines = context.length + added.length + 2;
  return `${header}--- a/${path}\n+++ b/${path}\n@@ -10,${oldLines} +10,${newLines} @@\n${hunk.join('\n')}\n`;
}

function workspacePatches(scope: 'branch' | 'uncommitted'): WorkspaceChangePatches {
  const changes = scope === 'branch' ? CHANGES : CHANGES.slice(0, 18);
  const tooLarge = 'mastra/packages/core/src/agent/index.ts';
  return {
    ...workspaceChanges(),
    changes,
    ...totals(changes),
    scope,
    patches: Object.fromEntries(
      changes.filter(change => change.path !== tooLarge).map((change, i) => [change.path, patchFor(change, i)]),
    ),
    omittedPatches: changes.some(change => change.path === tooLarge) ? { [tooLarge]: 'file-too-large' } : {},
  };
}

function treeListing(path: string): WorkspaceTreeEntry[] {
  const prefix = path ? `${path}/` : '';
  const directories = new Set<string>();
  const files: WorkspaceTreeEntry[] = [];
  for (const file of FILES) {
    if (!file.startsWith(prefix)) continue;
    const [name, ...rest] = file.slice(prefix.length).split('/');
    if (rest.length > 0) directories.add(name);
    else files.push({ name, path: file, type: 'file', size: 400 + ((file.length * 97) % 9000) });
  }
  return [
    ...[...directories]
      .toSorted()
      .map((name): WorkspaceTreeEntry => ({ name, path: `${prefix}${name}`, type: 'directory' })),
    ...files.toSorted((a, b) => a.name.localeCompare(b.name)),
  ];
}

function fileContent(path: string): string {
  if (path.endsWith('.md') || path.endsWith('.mdx')) {
    return `# ${path.split('/').at(-2)}\n\nHow this part of the workspace fits together.\n\n## Usage\n\n\`\`\`ts\nimport { Agent } from '@mastra/core/agent';\n\`\`\`\n`;
  }
  const body = Array.from(
    { length: 140 },
    (_, i) =>
      `export function step${i}(input: { id: string; attempt: number }) {\n  return { ...input, step: ${i} };\n}`,
  );
  return `import { Agent } from '@mastra/core/agent';\nimport { z } from 'zod';\n\n${body.join('\n\n')}\n`;
}

const sessionRef = (sessionId: string, threadId: string, branch: string) => ({
  sessionId,
  branch,
  threadId,
  startedBy: 'user-1',
});

const MAIN_REF = sessionRef(HEAVY.sessionId, HEAVY.threadId, HEAVY.branch);

function pullRequestSource(number: number, state: 'open' | 'merged' | 'closed', slug = 'mastra-ai/mastra') {
  return {
    id: `source-pr-${number}`,
    workItemId: 'card-main',
    provider: 'github',
    integrationId: 'github',
    sourceType: 'pull-request',
    workspaceId: null,
    externalId: `pull-request:github-pr:${number}`,
    sourceKey: `github:pull-request:github-pr:${number}`,
    key: `${slug}#${number}`,
    url: `https://github.com/${slug}/pull/${number}`,
    state: state === 'open' ? 'open' : 'closed',
    labels: [],
    author: 'factory-bot',
    metadata: { number, state, merged: state === 'merged', factoryAuthored: true },
    revision: 1,
    syncedAt: null,
    createdAt: new Date(ISO(-200)),
    updatedAt: new Date(ISO(-2)),
  } satisfies NonNullable<WorkItemRow['sources']>[number];
}

const STAYS = [
  'intake',
  'planning',
  'execute',
  'planning',
  'execute',
  'pr-review',
  'execute',
  'pr-review',
  'execute',
  'planning',
  'execute',
  'pr-review',
  'execute',
  'pr-review',
  'execute',
];

function card(id: string, overrides: Record<string, unknown>) {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: HEAVY.factoryId,
    board: 'work',
    parentWorkItemId: null,
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    revision: 1,
    createdAt: ISO(-240),
    updatedAt: ISO(-1),
    ...overrides,
  };
}

const LABELS = [
  'bug',
  'factory-ui',
  'design-system',
  'priority: high',
  'needs design review',
  'regression',
  'workspace',
  'accessibility',
  'good first issue',
];

const TITLE =
  'Workspace panel: tabs jump between views, Files has nothing to search with, and the diff canvas paints a darker block than the card it sits in';

const ISSUE_BODY = [
  '## What happens',
  '',
  'Switching between **Overview**, **Changes** and **Files** moves the tab labels a few pixels, and the panel resizes under the pointer.',
  '',
  '- Files lists folders but there is no way to jump to a file by name.',
  '- The diff canvas paints `--surface-2` on a card that uses `--card`.',
  '- Long branch names push the copy button off the row.',
  '',
  '## Expected',
  '',
  'Every view keeps the same top row, a file is one search away, and the diff sits on the card itself.',
].join('\n');

function workItems() {
  const main = card('card-main', {
    externalSource: {
      integrationId: 'github',
      type: 'issue',
      externalId: 'github-issue:20337',
      url: 'https://github.com/mastra-ai/mastra/issues/20337',
    },
    parentWorkItemId: 'card-epic',
    title: TITLE,
    description: 'Keep the diff on the card surface; no new colour token.',
    stages: ['execute'],
    stageHistory: STAYS.map((stage, i) => ({
      stage,
      enteredAt: ISO(-180 + i * 12),
      by: i % 3 === 0 ? 'user-1' : 'factory',
      ...(i < STAYS.length - 1 ? { exitedAt: ISO(-180 + (i + 1) * 12) } : {}),
    })),
    sessions: {
      work: MAIN_REF,
      review: sessionRef('sess-review', 'thread-review', 'factory/fac-1284-review'),
      fix: sessionRef('sess-fix', 'thread-fix', 'factory/fac-1284-fix-flaky-e2e'),
    },
    metadata: {
      number: 20337,
      labelColors: { bug: 'd73a4a', regression: 'b60205', accessibility: '0e8a16', 'design-system': '5319e7' },
    },
    workItem: {
      provider: 'github',
      key: 'mastra-ai/mastra#20337',
      url: 'https://github.com/mastra-ai/mastra/issues/20337',
      title: TITLE,
      state: 'open',
      labels: LABELS,
      author: 'octocat',
      metadata: { githubIssueNumber: 20337 },
      sources: [
        pullRequestSource(20411, 'open'),
        pullRequestSource(20398, 'open'),
        pullRequestSource(20377, 'merged'),
        pullRequestSource(20352, 'merged'),
        pullRequestSource(20349, 'closed'),
        pullRequestSource(20343, 'merged'),
        pullRequestSource(1182, 'open', 'mastra-ai/docs'),
        pullRequestSource(1176, 'merged', 'mastra-ai/docs'),
        pullRequestSource(87, 'open', 'mastra-ai/infra'),
      ],
    },
  });
  const epic = card('card-epic', {
    externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:FAC-1200' },
    title: 'Factory session panel v2',
    stages: ['planning'],
    metadata: { identifier: 'FAC-1200' },
  });
  const children = [
    ['card-c1', 'linear', 'FAC-1291', 'Tab indicator overshoots on Safari', 'pr-review'],
    ['card-c2', 'github', '20402', 'Go to file ranks folders above names', 'execute'],
    ['card-c3', 'slack', 'C123:1791936483.798759', 'Panel flickers when the sandbox wakes', 'intake'],
    ['card-c4', 'github', '20415', 'Change marks in the file tree', 'planning'],
    ['card-c5', 'linear', 'FAC-1302', 'Line numbers in the file viewer', 'done'],
    ['card-c6', 'jira', 'MC-88', 'Audit panel contrast in light mode', 'intake'],
    ['card-c7', 'github', '20420', 'Heavy-session fixture for screenshots', 'execute'],
  ].map(([id, integration, external, title, stage]) =>
    card(id, {
      externalSource:
        integration === 'slack'
          ? { integrationId: 'slack', type: 'slack-thread', workspaceId: 'T123', externalId: `slack:${external}` }
          : {
              integrationId: integration,
              type: 'issue',
              externalId: `${integration}:${external}`,
              ...(integration === 'github' ? { url: `https://github.com/mastra-ai/mastra/issues/${external}` } : {}),
            },
      parentWorkItemId: 'card-main',
      title,
      stages: [stage],
      metadata: integration === 'github' ? { number: Number(external) } : { identifier: external },
    }),
  );
  return [epic, main, ...children];
}

const SUBSCRIPTIONS: PullRequestSubscription[] = [
  {
    id: 's1',
    repoFullName: 'mastra-ai/mastra',
    pullRequestNumber: 20411,
    status: 'open',
    url: 'https://github.com/mastra-ai/mastra/pull/20411',
    updatedAt: '2026-07-29T00:00:00.000Z',
  },
  {
    id: 's2',
    repoFullName: 'mastra-ai/mastra',
    pullRequestNumber: 20425,
    status: 'open',
    url: 'https://github.com/mastra-ai/mastra/pull/20425',
    updatedAt: '2026-07-29T00:00:00.000Z',
  },
  {
    id: 's3',
    repoFullName: 'mastra-ai/mastra',
    pullRequestNumber: 20390,
    status: 'closed',
    url: 'https://github.com/mastra-ai/mastra/pull/20390',
    updatedAt: '2026-07-29T00:00:00.000Z',
  },
  {
    id: 's4',
    repoFullName: 'mastra-ai/docs',
    pullRequestNumber: 1190,
    status: 'merged',
    url: 'https://github.com/mastra-ai/docs/pull/1190',
    updatedAt: '2026-07-29T00:00:00.000Z',
  },
];

function session(sessionId: string, branch: string, title: string) {
  return {
    id: `row-${sessionId}`,
    sessionId,
    projectRepositoryId: HEAVY.repositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    branch,
    title,
    baseBranch: 'main',
    sandboxId: `sb-${sessionId}`,
    sandboxWorkdir: '/workspace',
    materializedAt: ISO(-200),
    capabilities: { recreateSandbox: true, takeOwnership: false },
    createdAt: ISO(-240),
    updatedAt: ISO(-1),
  };
}

const SESSIONS = [
  session(HEAVY.sessionId, HEAVY.branch, 'Unify the workspace panel'),
  session('sess-review', 'factory/fac-1284-review', 'Review the workspace panel'),
  session('sess-fix', 'factory/fac-1284-fix-flaky-e2e', 'Fix the flaky panel e2e'),
];

const AC = '*/api/agent-controller/code';

const repositories: ProjectListRepository[] = REPOSITORIES.map(repository =>
  listedRepository(repository.id, repository.slug, {
    branch: 'main',
  }),
);

export const heavySessionHandlers = [
  http.get('*/auth/me', () =>
    HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
  ),
  http.get('*/web/factory/projects', () =>
    HttpResponse.json({ projects: [{ id: HEAVY.factoryId, name: 'Mastra Factory', repositories }] }),
  ),
  http.get(`*/web/factory/projects/${HEAVY.factoryId}`, () =>
    HttpResponse.json({
      project: { id: HEAVY.factoryId, name: 'Mastra Factory', defaultModelId: 'openai/gpt-4o-mini' },
    }),
  ),
  http.get('*/web/intake/config', () => HttpResponse.json({ config: {} })),
  http.get('*/web/config/default-model', () => HttpResponse.json({ modelId: null, thinkingLevel: null })),
  http.get('*/web/linear/status', () => HttpResponse.json({ enabled: false, connected: false })),
  http.get('*/web/voice/settings', () =>
    HttpResponse.json({
      scope: 'user',
      selected: null,
      canEdit: true,
      effective: null,
      models: [],
      keys: [],
    } satisfies VoiceSettingsResponse),
  ),
  http.get('*/web/github/projects/:id/issues', () => HttpResponse.json({ issues: [], nextPage: null })),
  http.get('*/web/github/projects/:id/issues/:number', ({ params }) =>
    HttpResponse.json({ number: Number(params.number), description: ISSUE_BODY }),
  ),
  http.get(
    `*/web/factory/projects/${HEAVY.factoryId}/feed-events`,
    () =>
      new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
        headers: { 'content-type': 'text/event-stream' },
      }),
  ),
  http.get(`*/web/factory/projects/${HEAVY.factoryId}/sessions`, () => HttpResponse.json({ sessions: SESSIONS })),
  http.get('*/web/user-sessions/:sessionId', ({ params }) =>
    HttpResponse.json({ session: SESSIONS.find(candidate => candidate.sessionId === params.sessionId) ?? SESSIONS[0] }),
  ),
  http.get(`*/web/factory/projects/${HEAVY.factoryId}/work-items`, () => HttpResponse.json({ workItems: workItems() })),
  http.get('*/web/github/subscriptions', () => HttpResponse.json({ subscriptions: SUBSCRIPTIONS })),
  http.post(`${AC}/sessions`, () =>
    HttpResponse.json({ controllerId: 'code', resourceId: HEAVY.sessionId, threadId: HEAVY.threadId }),
  ),
  http.get(`${AC}/sessions/:sessionId`, () =>
    HttpResponse.json({
      controllerId: 'code',
      resourceId: HEAVY.sessionId,
      modeId: 'build',
      modelId: 'openai/gpt-4o-mini',
      threadId: HEAVY.threadId,
      settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
    }),
  ),
  http.put(`${AC}/sessions/:sessionId/state`, () => HttpResponse.json({ ok: true })),
  http.get(
    `${AC}/sessions/:sessionId/stream`,
    () =>
      new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
        headers: { 'content-type': 'text/event-stream' },
      }),
  ),
  http.get(`${AC}/sessions/:sessionId/permissions`, () => HttpResponse.json({})),
  http.get(`${AC}/sessions/:sessionId/threads`, () => HttpResponse.json({ threads: [] })),
  http.get(`${AC}/sessions/:sessionId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
  http.get('*/web/workspace/rendered/list', () =>
    HttpResponse.json({ workspacePath: HEAVY.sessionId, root: '.artifacts', rootPath: '', entries: [] }),
  ),
  http.get('*/web/workspace/changes', () => HttpResponse.json(workspaceChanges())),
  http.get('*/web/workspace/changes/patches', ({ request }) =>
    HttpResponse.json(
      workspacePatches(new URL(request.url).searchParams.get('scope') === 'uncommitted' ? 'uncommitted' : 'branch'),
    ),
  ),
  http.get('*/web/workspace/tree', ({ request }) => {
    const path = new URL(request.url).searchParams.get('path') ?? '';
    return HttpResponse.json({ workspacePath: HEAVY.sessionId, path, available: true, entries: treeListing(path) });
  }),
  http.get('*/web/workspace/files', () =>
    HttpResponse.json({
      workspacePath: HEAVY.sessionId,
      available: true,
      paths: FILES,
      truncated: false,
    } satisfies WorkspaceFileIndex),
  ),
  http.get('*/web/workspace/file', ({ request }) => {
    const path = new URL(request.url).searchParams.get('path') ?? '';
    const content = fileContent(path);
    return HttpResponse.json({
      workspacePath: HEAVY.sessionId,
      path,
      name: path.split('/').at(-1) ?? path,
      size: content.length,
      updatedAt: ISO(-1),
      contentType: 'text',
      content,
    } satisfies WorkspaceFile);
  }),
];
