import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Octokit } from 'octokit';

// Runs under pull_request_target: only base-branch files are on disk, the diff comes from the API.
// Output is a single risk:* label. Any failure leaves the current label alone.

const RISKS = ['low', 'medium', 'high'] as const;
type Risk = (typeof RISKS)[number];
const LABELS: Record<Risk, string> = { low: 'risk: low', medium: 'risk: medium', high: 'risk: high' };
const COLORS: Record<Risk, string> = { low: '0e8a16', medium: 'fbca04', high: 'b60205' };
const DIFF_BUDGET = 60_000;
const MIN_CONFIDENCE = 0.6;
const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_MODEL = 'jev-latest';

// The rubric. Jev does not know what these labels mean in this repo, so spell it out.
const INSTRUCTIONS =
  'How much damage could this pull request to the Mastra monorepo do to Mastra users if it is wrong? ' +
  'Judge what the lines in `diff` actually change, not file size or effort. `files` gives each file its package ' +
  'and how many in-repo packages depend on it: that shows how far a mistake spreads, but a path alone is not the answer. ' +
  'Docs-only or comment-only changes inside @mastra/core are low. A one-line change to a @mastra/core stream, retry or ' +
  'agent loop path is high. When torn between two levels, pick the higher one.';
const CRITERIA: Record<Risk, string> = {
  low:
    'Safe to approve after a quick read. Documentation, comments, JSDoc, README or changeset text anywhere, including inside @mastra/core. ' +
    'Tests, fixtures or recordings with no shipped code change. Type-only changes that keep public signatures. ' +
    'Unpublished examples, templates or explorations. A small, clearly correct bug fix with a test in a leaf package ' +
    '(one store, voice, auth, deployer, observability or channel provider with few or no in-repo dependents) that does not ' +
    'change its public API, persisted data or security behaviour. Internal tooling that runs without secrets.',
  medium:
    'Needs a real review of the logic, but a mistake would be noticed quickly and affect a limited set of users. ' +
    'Leaf-package behaviour beyond a trivial fix: new options, changed defaults, new network calls, connection or transport handling. ' +
    'Additive public API in a shared package that leaves existing callers unchanged. Runtime dependency additions or bumps, ' +
    'build or bundler config. Any CI workflow or GitHub Action change. Small contained runtime fixes in shared packages ' +
    '(server, memory, deployer, cli, client SDKs) outside their hot paths. Hot-path @mastra/core changes are never lower than this.',
  high:
    'Needs careful review by an owner; a mistake could silently break many users, lose data or open a security hole. ' +
    'Any runtime change, however small, to @mastra/core hot paths: agent loop, model calls and streaming, retries and error ' +
    'processors, message list and memory, tool execution, workflow engine, processors, storage base classes. ' +
    'Breaking or behaviour-changing public API in a widely used package (removed or renamed exports, changed defaults or return shapes). ' +
    'Storage schema changes, migrations, or anything that rewrites persisted data. Authentication, authorization, permission checks, ' +
    'secrets, sandboxing or input-validation boundaries. Concurrency, ordering, locking, cancellation or suspend/resume in shared code. ' +
    'Workflows on pull_request_target or anything else handling untrusted input with secrets.',
};

type File = { filename: string; status: string; additions: number; deletions: number; patch?: string };

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const isTest = (f: string) =>
  /(^|\/)(test|tests|__tests__|__fixtures__|__recordings__|__snapshots__|__mocks__)\//.test(f) ||
  /\.(test|spec)\.[cm]?[jt]sx?$|\.test-d\.ts$/.test(f) ||
  f.startsWith('e2e-tests/');
// Markdown the runtime reads (skills, prompts, .github instructions) is not docs.
const isDocs = (f: string) =>
  !f.startsWith('.github/') && !/(^|\/)(SKILL\.md$|prompts?\/)/.test(f) && (f.startsWith('docs/') || /\.mdx?$/.test(f));
const isChangeset = (f: string) => /^\.changeset\/[^/]+\.md$/.test(f);
const isLockfile = (f: string) => /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(f);

// These paths always get at least medium, whatever the model says.
function needsReview(f: string) {
  if (/^\.github\/(workflows|actions)\//.test(f)) return true;
  if (isDocs(f) || isTest(f)) return false;
  return /(^|\/)migrations?([/._-]|$)/i.test(f) || /^auth\/|\/src\/(.*\/)?auth\//.test(f);
}

// Package name and how many in-repo packages depend on it, from base-branch manifests.
function loadPackages(repoRoot: string) {
  const pkgs: { name: string; dir: string; deps: string[] }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) walk(rel);
      else if (entry.name === 'package.json' && dir) {
        try {
          const json = JSON.parse(readFileSync(join(repoRoot, rel), 'utf8'));
          const deps = { ...json.dependencies, ...json.peerDependencies, ...json.optionalDependencies };
          if (json.name) pkgs.push({ name: json.name, dir, deps: Object.keys(deps) });
        } catch {}
      }
    }
  };
  walk('');
  const dependents = new Map<string, Set<string>>();
  for (const p of pkgs) for (const d of p.deps) dependents.set(d, (dependents.get(d) ?? new Set()).add(p.name));
  const count = (name: string) => {
    const seen = new Set<string>();
    const queue = [name];
    while (queue.length) for (const d of dependents.get(queue.pop()!) ?? []) if (!seen.has(d)) seen.add(d), queue.push(d);
    return seen.size;
  };
  pkgs.sort((a, b) => b.dir.length - a.dir.length);
  return (file: string) => {
    const pkg = pkgs.find(p => file.startsWith(`${p.dir}/`));
    return pkg ? { package: pkg.name, inRepoDependents: count(pkg.name) } : { package: null, inRepoDependents: 0 };
  };
}

// Runtime code first, docs/tests last, lockfiles never; whole files until the budget runs out.
function buildDiff(files: File[]) {
  const weight = (f: string) => (isLockfile(f) ? 0 : isDocs(f) || isChangeset(f) ? 1 : isTest(f) ? 2 : 3);
  const ranked = files.filter(f => f.patch && weight(f.filename) > 0).sort((a, b) => weight(b.filename) - weight(a.filename));
  let used = 0;
  const shown = new Set<string>();
  for (const f of ranked) {
    if (used + f.patch!.length > DIFF_BUDGET) continue;
    used += f.patch!.length;
    shown.add(f.filename);
  }
  return files.filter(f => shown.has(f.filename)).map(f => `--- ${f.filename}\n${f.patch}`).join('\n');
}

async function askJev(apiKey: string, model: string, title: string, files: File[], repoRoot: string): Promise<Risk> {
  const packageOf = loadPackages(repoRoot);
  const state = {
    title,
    files: files.map(f => ({ path: f.filename, status: f.status, added: f.additions, removed: f.deletions, ...packageOf(f.filename) })),
    diff: buildDiff(files),
  };
  const res = await fetch(JEV_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, state, questions: { risk: { type: 'choice', instructions: INSTRUCTIONS, criteria: CRITERIA } } }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Jev returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const answer = ((await res.json()) as any)?.answers?.risk;
  if (!RISKS.includes(answer?.choice) || typeof answer?.confidence !== 'number') {
    throw new Error(`Jev returned an unusable answer: ${JSON.stringify(answer)?.slice(0, 300)}`);
  }
  console.log(`Jev chose ${answer.choice} with confidence ${answer.confidence}`);
  return answer.confidence < MIN_CONFIDENCE ? 'medium' : answer.choice;
}

async function main() {
  const owner = env('OWNER');
  const repo = env('REPO');
  const issue_number = Number(env('PR_NUMBER'));
  const repoRoot = resolve(process.env.REPO_ROOT || join(import.meta.dirname, '../..'));
  const octokit = new Octokit({ auth: env('GITHUB_TOKEN') });

  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: issue_number });
  const files: File[] = await octokit.paginate(octokit.rest.pulls.listFiles, { owner, repo, pull_number: issue_number, per_page: 100 });

  let risk: Risk;
  if (files.every(f => isDocs(f.filename) || isChangeset(f.filename) || isTest(f.filename))) {
    risk = 'low';
    console.log('Only docs, changesets or tests changed: low');
  } else {
    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey) return console.log('::warning::TYPESAFE_API_KEY is not set; leaving the risk label unchanged');
    try {
      risk = await askJev(apiKey, process.env.RISK_MODEL || DEFAULT_MODEL, pr.title, files, repoRoot);
    } catch (error) {
      return console.log(`::warning::Could not rate the PR, leaving the risk label unchanged: ${error}`);
    }
    if (risk === 'low' && files.some(f => needsReview(f.filename))) risk = 'medium';
  }

  const current = pr.labels.map(l => l.name).filter(n => Object.values(LABELS).includes(n));
  for (const name of current.filter(n => n !== LABELS[risk])) {
    await octokit.rest.issues.removeLabel({ owner, repo, issue_number, name }).catch(e => { if (e.status !== 404) throw e; });
  }
  if (!current.includes(LABELS[risk])) {
    await octokit.rest.issues.createLabel({ owner, repo, name: LABELS[risk], color: COLORS[risk] }).catch(e => { if (e.status !== 422) throw e; });
    await octokit.rest.issues.addLabels({ owner, repo, issue_number, labels: [LABELS[risk]] });
  }
  console.log(`Labeled #${issue_number} ${LABELS[risk]}`);
}

await main();
