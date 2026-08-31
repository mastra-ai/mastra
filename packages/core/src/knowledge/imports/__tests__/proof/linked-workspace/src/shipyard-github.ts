import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { knowledgeImporterBindingKey } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';

const repository = 'mastra-ai/mastra';
const githubSource = `github:${repository}`;
const agentSource = `github:${repository}:merged-pr`;
const repoBinding = { source: githubSource, scope: 'repo:mastra' } as const;
const featureBinding = { source: agentSource, scope: 'feature:knowledge' } as const;
const model = process.env.MODEL_ID || 'openai/gpt-5-mini';
const githubToken = process.env.GITHUB_TOKEN;
const outArg = process.argv.indexOf('--out');
const outputDirectory = resolve(outArg >= 0 ? process.argv[outArg + 1]! : './proof-github');
const dbPath = resolve(outputDirectory, 'shipyard-github.db');

if (!githubToken) throw new Error('GITHUB_TOKEN is required for the Shipyard GitHub proof');
if (!process.env.OPENAI_API_KEY && !process.env.MASTRA_API_KEY) {
  throw new Error('OPENAI_API_KEY or MASTRA_API_KEY is required for the real-provider Shipyard GitHub proof');
}

function invariant(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function stableRecordId(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function compact(value: string | null | undefined, limit: number): string {
  return (value ?? '').replaceAll(/\s+/g, ' ').trim().slice(0, limit);
}

type GitHubIssue = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  updated_at: string;
  pull_request?: unknown;
};
type GitHubPull = GitHubIssue & {
  merged_at: string | null;
  merge_commit_sha: string | null;
  base: { ref: string };
  user: { login: string };
};
type GitHubFile = {
  filename: string;
  status: string;
  sha: string;
  patch?: string;
};
type StaticPayload = {
  issue: GitHubIssue;
  pull: GitHubPull;
  files: GitHubFile[];
  sourceExcerpt: string;
  cursor: string;
  failAfterWrite?: boolean;
};

async function githubApi<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'User-Agent': 'mastra-knowledge-shipyard-proof',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`GitHub request failed (${response.status}) for ${path}`);
  return response.json() as Promise<T>;
}

function github<T>(path: string): Promise<T> {
  return githubApi<T>(`/repos/${repository}${path}`);
}

async function loadSourceWindow(): Promise<StaticPayload> {
  const pullQuery = encodeURIComponent(`repo:${repository} is:pr is:merged knowledge in:title`);
  const issueQuery = encodeURIComponent(`repo:${repository} is:issue knowledge in:title`);
  const [pullSearch, issueSearch] = await Promise.all([
    githubApi<{ items: GitHubIssue[] }>(`/search/issues?q=${pullQuery}&sort=updated&order=desc&per_page=20`),
    githubApi<{ items: GitHubIssue[] }>(`/search/issues?q=${issueQuery}&sort=updated&order=desc&per_page=20`),
  ]);
  const candidate = pullSearch.items[0];
  invariant(candidate, 'No merged Knowledge pull request was found in the bounded GitHub window');
  const issue = issueSearch.items[0];
  invariant(issue, 'No Knowledge issue was found in the bounded GitHub window');
  invariant(!issue.pull_request, 'Bounded GitHub issue search returned a pull request');
  const pull = await github<GitHubPull>(`/pulls/${candidate.number}`);
  invariant(pull.merge_commit_sha, 'Selected Knowledge pull request has no merge commit SHA');
  const files = (await github<GitHubFile[]>(`/pulls/${pull.number}/files?per_page=30`)).slice(0, 12);
  const readable =
    files.find(file => file.status !== 'removed' && /\.(?:[cm]?[jt]sx?|mdx?)$/.test(file.filename)) ??
    files.find(file => file.status !== 'removed');
  invariant(readable, 'Merged pull request has no readable changed source file');
  let sourceExcerpt = compact(readable.patch, 4_000);
  if (!sourceExcerpt) {
    const content = await github<{ content?: string; encoding?: string }>(
      `/contents/${encodeURIComponent(readable.filename).replaceAll('%2F', '/')}?ref=${pull.merge_commit_sha}`,
    );
    sourceExcerpt =
      content.encoding === 'base64' && content.content
        ? Buffer.from(content.content.replaceAll('\n', ''), 'base64').toString('utf8').slice(0, 4_000)
        : '';
  }
  invariant(sourceExcerpt, 'GitHub source file returned no bounded content');
  return { issue, pull, files, sourceExcerpt, cursor: pull.merge_commit_sha };
}

function createAgent(storage: LibSQLStore) {
  const memory = new Memory({
    storage,
    options: {
      observationalMemory: {
        scope: 'resource',
        model,
        observation: { messageTokens: 100_000 },
      },
    },
  });
  const agent = new Agent({
    id: 'shipyard-github-distiller',
    name: 'Shipyard GitHub distiller',
    instructions: 'Integrate merged pull-request evidence into feature-first Knowledge without inventing facts.',
    model,
    memory,
  });
  return { agent, memory };
}

function createKnowledge(storage: LibSQLStore, sourceWindow: StaticPayload, onAgentResult: (text: string) => void) {
  const { agent, memory } = createAgent(storage);
  const knowledge = new Knowledge({
    id: 'mastra',
    description: 'Mastra organization knowledge, reconciled from source evidence.',
    storage,
    structure: {
      scopes: [
        { address: 'org:mastra', name: 'Mastra' },
        {
          address: repoBinding.scope,
          name: 'Mastra repository',
          parentAddresses: ['org:mastra'],
          metadata: { description: 'Static GitHub issue, pull-request, and source evidence.' },
        },
        {
          address: featureBinding.scope,
          name: 'Knowledge',
          parentAddresses: [repoBinding.scope],
          metadata: { description: 'Current Knowledge architecture and decisions supported by repository evidence.' },
        },
      ],
    },
    importers: [
      {
        id: 'github-static',
        access: { 'repo:$repo': 'owner' },
        handler: async context => {
          const payload = context.payload as StaticPayload;
          const importer = await context.importer();
          const entries = [
            {
              address: `issue:${payload.issue.number}`,
              name: payload.issue.title,
              text: `Issue #${payload.issue.number}: ${compact(payload.issue.body, 1_500) || payload.issue.title}`,
              metadata: { type: 'issue', url: payload.issue.html_url, updatedAt: payload.issue.updated_at },
            },
            {
              address: `pr:${payload.pull.number}`,
              name: payload.pull.title,
              text: `Merged PR #${payload.pull.number}: ${compact(payload.pull.body, 1_500) || payload.pull.title}`,
              metadata: {
                type: 'pull-request',
                url: payload.pull.html_url,
                mergedAt: payload.pull.merged_at,
                mergeCommitSha: payload.pull.merge_commit_sha,
              },
            },
            ...payload.files.map((file, index) => ({
              address: `source:${file.filename}`,
              name: file.filename,
              text:
                index === 0
                  ? `Source ${file.filename} at ${payload.cursor}: ${compact(payload.sourceExcerpt, 2_000)} [[pr:${payload.pull.number}]]`
                  : `Changed source ${file.filename} (${file.status}) in [[pr:${payload.pull.number}]]`,
              metadata: { type: 'source', path: file.filename, status: file.status, sha: file.sha },
            })),
          ];
          for (const entry of entries) {
            await importer.upsertNode(entry.address, { name: entry.name, metadata: entry.metadata });
          }
          for (const entry of entries) {
            const node = await importer.getNode(entry.address);
            invariant(node, `Static GitHub node disappeared before record reconciliation: ${entry.address}`);
            const id = stableRecordId(`${entry.address}:${payload.cursor}:${entry.text}`);
            const records = await node.listKnowledge();
            for (const record of records) if (record.id !== id) await node.removeKnowledge(record.id);
            if (!records.some(record => record.id === id)) {
              await node.appendKnowledge({ id, text: entry.text, metadata: entry.metadata });
            }
          }
          if (payload.failAfterWrite) throw new Error('simulated restart before GitHub checkpoint commit');
          await context.state.set('mergeSha', payload.cursor);
        },
      },
      {
        id: 'github-merged-pr-distiller',
        access: { 'feature:$feature': 'owner', 'repo:mastra': 'readonly' },
        agentic: { agent, maxSteps: 12 },
        handler: async context => {
          const pull = sourceWindow.pull;
          const result = await context.agentImport!({
            instructions: [
              `Distill PR #${pull.number} into exactly one durable decision node at address decision:pr-${pull.number}.`,
              'Set its name to one concise architectural outcome from the supplied diff, not a generic label.',
              `Also set metadata.summary to that outcome and metadata.provenance to [[pr:${pull.number}]].`,
              'Use only the supplied bounded PR evidence; do not copy a changelog or invent rationale.',
            ].join(' '),
            data: {
              pullRequest: {
                number: pull.number,
                title: pull.title,
                body: compact(pull.body, 3_000),
                mergedAt: pull.merged_at,
                mergeCommitSha: pull.merge_commit_sha,
                files: sourceWindow.files.map(file => ({
                  path: file.filename,
                  status: file.status,
                  patch: compact(file.patch, 1_200),
                })),
              },
            },
            checkpoint: pull.merge_commit_sha!,
          });
          const importer = await context.importer();
          const decision = await importer.getNode(`decision:pr-${pull.number}`);
          invariant(decision, 'Agentic distiller did not create its decision node');
          const metadataSummary = decision.node.metadata?.summary;
          const summary =
            typeof metadataSummary === 'string' && metadataSummary.trim() ? metadataSummary : decision.node.name;
          invariant(summary.trim(), 'Agentic distiller did not return a decision summary');
          const text = summary.includes(`[[pr:${pull.number}]]`)
            ? summary.trim()
            : `${summary.trim()} [[pr:${pull.number}]]`;
          const id = stableRecordId(`decision:pr-${pull.number}:${result.checkpoint}:${text}`);
          const records = await decision.listKnowledge();
          for (const record of records) if (record.id !== id) await decision.removeKnowledge(record.id);
          if (!records.some(record => record.id === id)) {
            await decision.appendKnowledge({
              id,
              text,
              metadata: { provenance: `[[pr:${pull.number}]]`, mergeCommitSha: result.checkpoint },
            });
          }
          onAgentResult(result.text);
          await context.state.set('mergeSha', result.checkpoint);
        },
      },
    ],
  });
  return { knowledge, memory };
}

await mkdir(outputDirectory, { recursive: true });
await rm(dbPath, { force: true });
const sourceWindow = await loadSourceWindow();
const storage = new LibSQLStore({ id: 'shipyard-github-proof', url: `file:${dbPath}` });
let knowledge: Knowledge | undefined;
let agentText = '';

try {
  let runtime = createKnowledge(storage, sourceWindow, text => (agentText = text));
  knowledge = runtime.knowledge;
  let reconciled = await knowledge.reconcile();
  const staticImporter = knowledge.getImporter('github-static')!;
  const failed = await staticImporter.run(repoBinding, { ...sourceWindow, failAfterWrite: true });
  invariant(failed.status === 'failed', 'Interrupted static GitHub run did not fail');
  invariant(
    !(await knowledge.getImportState({
      importerId: 'github-static',
      binding: knowledgeImporterBindingKey(repoBinding),
      key: 'mergeSha',
    })),
    'Interrupted static GitHub run committed its checkpoint',
  );
  const preRestartAddress = await (
    await knowledge.getStorage()
  ).getNodeAddress({
    source: githubSource,
    address: `pr:${sourceWindow.pull.number}`,
  });
  invariant(preRestartAddress, 'Interrupted static GitHub run did not commit source evidence');
  await knowledge.shutdownImporters();

  runtime = createKnowledge(storage, sourceWindow, text => (agentText = text));
  knowledge = runtime.knowledge;
  const memory = runtime.memory;
  reconciled = await knowledge.reconcile();
  const replay = await knowledge.getImporter('github-static')!.run(repoBinding, sourceWindow);
  invariant(replay.status === 'succeeded', `Static GitHub replay failed: ${replay.error ?? 'unknown error'}`);
  const staticCheckpoint = await knowledge.getImportState({
    importerId: 'github-static',
    binding: knowledgeImporterBindingKey(repoBinding),
    key: 'mergeSha',
  });
  invariant(staticCheckpoint?.value === sourceWindow.cursor, 'Static GitHub replay did not commit the SHA checkpoint');
  const replayAddress = await (
    await knowledge.getStorage()
  ).getNodeAddress({
    source: githubSource,
    address: `pr:${sourceWindow.pull.number}`,
  });
  invariant(replayAddress?.nodeId === preRestartAddress.nodeId, 'Static GitHub replay changed the PR node identity');
  const repoScopeId = reconciled.scopes[repoBinding.scope]!;
  const issueAddress = await (
    await knowledge.getStorage()
  ).getNodeAddress({
    source: githubSource,
    address: `issue:${sourceWindow.issue.number}`,
  });
  invariant(issueAddress, 'Static GitHub replay did not retain the issue-view node');
  const sourceAddresses = await Promise.all(
    sourceWindow.files.map(file =>
      knowledge!
        .getStorage()
        .then(storage => storage.getNodeAddress({ source: githubSource, address: `source:${file.filename}` })),
    ),
  );
  invariant(sourceAddresses.every(Boolean), 'Static GitHub replay did not retain every bounded source-file node');
  const staticRecords = (
    await knowledge.listRecordsBySource({ source: githubSource, scopeIds: [repoScopeId], limit: 100 })
  ).records;
  invariant(
    staticRecords.length === sourceWindow.files.length + 2,
    'Static GitHub replay did not converge its record set',
  );
  invariant(
    staticRecords.some(
      record => record.nodeId === issueAddress.nodeId && record.text.includes(`Issue #${sourceWindow.issue.number}`),
    ) &&
      staticRecords.some(
        record =>
          record.nodeId === replayAddress.nodeId && record.text.includes(`Merged PR #${sourceWindow.pull.number}`),
      ),
    'Static GitHub issue and PR records are missing',
  );
  invariant(
    sourceAddresses.every(address =>
      staticRecords.some(
        record => record.nodeId === address!.nodeId && record.text.includes(`[[pr:${sourceWindow.pull.number}]]`),
      ),
    ),
    'Static GitHub source records are not linked to PR provenance',
  );
  const prMentions = (
    await knowledge.listMentioningRecords({ node: replayAddress.nodeId, scopeIds: [repoScopeId], limit: 100 })
  ).records;
  invariant(
    prMentions.length === sourceWindow.files.length,
    `Static GitHub wikilink relationships did not materialize (${prMentions.length}/${sourceWindow.files.length})`,
  );

  const agentic = await knowledge.getImporter('github-merged-pr-distiller')!.run(featureBinding);
  invariant(
    agentic.status === 'succeeded',
    `Agentic merged-PR distillation failed: ${agentic.error ?? 'unknown error'}`,
  );
  invariant(agentic.transcriptThreadId, 'Agentic run did not retain a transcript reference');
  const decisionAddress = await (
    await knowledge.getStorage()
  ).getNodeAddress({
    source: agentSource,
    address: `decision:pr-${sourceWindow.pull.number}`,
  });
  invariant(decisionAddress, 'Agentic run did not create the stable decision address');
  const featureScopeId = reconciled.scopes[featureBinding.scope]!;
  const decisionScopeIds = await (await knowledge.getStorage()).getNodeScopeIds(decisionAddress.nodeId);
  invariant(
    decisionScopeIds.length === 1 && decisionScopeIds[0] === featureScopeId,
    'Agentic decision was not placed exclusively in the Knowledge feature scope',
  );
  const decisionRecords = (
    await knowledge.listRecords({ node: decisionAddress.nodeId, scopeIds: [featureScopeId, repoScopeId], limit: 100 })
  ).records;
  const diagnosticActivity = await knowledge.listActivity({
    scopeIds: [featureScopeId, repoScopeId],
    importRunId: agentic.id,
    limit: 100,
  });
  invariant(
    decisionRecords.length === 1,
    `Agentic run produced ${decisionRecords.length} visible decision records; activity: ${diagnosticActivity.map(event => `${event.action}:${event.targetType}`).join(',')}; completion: ${compact(agentText, 500)}`,
  );
  invariant(
    decisionRecords[0]!.text.includes(`[[pr:${sourceWindow.pull.number}]]`),
    'Agentic decision record omitted PR provenance',
  );
  const staticActivity = await knowledge.listActivity({
    scopeIds: [repoScopeId],
    importRunId: failed.id,
    limit: 100,
  });
  const agentActivity = await knowledge.listActivity({
    scopeIds: [featureScopeId, repoScopeId],
    importRunId: agentic.id,
    limit: 100,
  });
  invariant(staticActivity.length > 0 && agentActivity.length > 0, 'Import activity is not linked to both run headers');
  const transcriptThread = await memory.getThreadById({ threadId: agentic.transcriptThreadId });
  invariant(transcriptThread, 'Retained agentic transcript thread is not readable from Memory');

  const result = {
    repository,
    model,
    sourceWindow: {
      issue: sourceWindow.issue.number,
      pullRequest: sourceWindow.pull.number,
      mergeCommitSha: sourceWindow.cursor,
      changedFiles: sourceWindow.files.length,
    },
    staticImport: {
      interruptedStatus: failed.status,
      replayStatus: replay.status,
      checkpoint: staticCheckpoint.value,
      stableNodeId: replayAddress.nodeId,
      scopeId: repoScopeId,
      issueNodeCount: 1,
      pullRequestNodeCount: 1,
      sourceNodeCount: sourceAddresses.length,
      recordCount: staticRecords.length,
      crossLinksVerified: true,
      activityCount: staticActivity.length,
    },
    agenticImport: {
      status: agentic.status,
      destinationScopeId: featureScopeId,
      runId: agentic.id,
      transcriptThreadId: agentic.transcriptThreadId,
      decisionNodeId: decisionAddress.nodeId,
      recordId: decisionRecords[0]!.id,
      provenance: `[[pr:${sourceWindow.pull.number}]]`,
      activityCount: agentActivity.length,
    },
  };
  const transcript = [
    'Shipyard GitHub agentic distillation transcript (sanitized)',
    `Run: ${agentic.id}`,
    `Thread: ${agentic.transcriptThreadId}`,
    `Source: ${sourceWindow.pull.html_url}`,
    `Decision: ${decisionRecords[0]!.text}`,
    `Provider completion: ${compact(agentText, 1_000)}`,
  ].join('\n');
  await writeFile(resolve(outputDirectory, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile(resolve(outputDirectory, 'transcript.txt'), `${transcript}\n`, 'utf8');
  console.log(JSON.stringify(result));
  console.log('PROOF: GREEN — real GitHub source and agentic distillation passed');
} finally {
  await knowledge?.shutdownImporters().catch(() => undefined);
  await storage.close();
  await Promise.all([dbPath, `${dbPath}-wal`, `${dbPath}-shm`].map(path => rm(path, { force: true })));
}
