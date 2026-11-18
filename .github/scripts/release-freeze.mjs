#!/usr/bin/env node

// Freezes merges to main during a release, except the versioning PR, so merges
// stop rerunning version-packages.yml and restarting the versioning PR's CI.
// Run by .github/workflows/release-freeze.yml and npm-publish.yml.
//
// The "Release merge freeze" ruleset requires one status check on main,
// "Release freeze", that only the Dane app can post. Dane posts it (success) on
// the head of changeset-release/main and nowhere else, so while the ruleset is
// active every other PR waits on a check it never gets, and the versioning PR
// merges as usual. A repo admin creates the ruleset once, disabled; this script
// only ever sends { enforcement } so its bypass list and rules stay as set.
// It fails closed: an actor without write access, a lookup that errors, a
// missing or duplicated ruleset, or a ruleset of any other shape all stop it
// before any write.
//
// Actions:
//   freeze --actor <login> [--dry-run]    pass the versioning PR, then turn the ruleset on
//   unfreeze --actor <login> [--dry-run]  turn the ruleset off
//   mark                                  pass the current changeset-release/main head
//   check                                 read-only: is main frozen? (no ruleset = no)
//
// Env: GITHUB_TOKEN (administration: write and statuses: write for freeze,
// administration: write for unfreeze, statuses: write for mark, read for
// check), GITHUB_REPOSITORY, GITHUB_API_URL (default https://api.github.com),
// APP_SLUG (freeze, unfreeze: the token's GitHub App, whose id the ruleset's
// check must be pinned to), GITHUB_STEP_SUMMARY and GITHUB_OUTPUT (optional). Outputs: frozen=true|false
// (all but mark) and changed=true|false (freeze, unfreeze).
//
// Exit codes: 0 = done (or would be, on a dry run)
//             1 = refused or failed; nothing was changed unless the PUT itself
//                 succeeded and read back wrong
//             2 = usage error

import { appendFileSync } from 'node:fs';

export const RULESET_NAME = 'Release merge freeze';
export const CHECK_NAME = 'Release freeze';
const VERSIONING_BRANCH = 'changeset-release/main';
// Base permission from the collaborator API: maintain and custom roles built on
// write report "write"; triage reports "read". Write is what GitHub already
// requires to dispatch a workflow, so anyone who can start it may freeze main.
const ALLOWED_PERMISSIONS = new Set(['admin', 'write']);
const TARGET = { freeze: 'active', unfreeze: 'disabled' };
const ACTIONS = ['freeze', 'unfreeze', 'mark', 'check'];
const USAGE =
  'Usage: node release-freeze.mjs --action freeze|unfreeze --actor <login> [--dry-run]\n' +
  '       node release-freeze.mjs --action mark|check';

function usage(message) {
  console.error(message);
  console.error(USAGE);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--dry-run') {
      args.dryRun = true;
    } else if (flag === '--action' || flag === '--actor') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) usage(`Missing value for ${flag}`);
      args[flag.slice(2)] = value;
    } else {
      usage(`Unknown argument: ${flag}`);
    }
  }
  if (!ACTIONS.includes(args.action)) usage(`--action must be ${ACTIONS.join(', ')}; got ${args.action ?? 'nothing'}`);
  if (args.action in TARGET && !args.actor) usage('Missing --actor');
  return args;
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function makeApi({ baseUrl, token }) {
  async function request(method, url, body) {
    const res = await fetch(url.startsWith('http') ? url : `${baseUrl}${url}`, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new ApiError(`${method} ${url} failed: HTTP ${res.status} ${text.slice(0, 300)}`, res.status);
    return { data: text ? JSON.parse(text) : null, link: res.headers.get('link') };
  }

  return {
    get: async url => (await request('GET', url)).data,
    put: async (url, body) => (await request('PUT', url, body)).data,
    post: async (url, body) => (await request('POST', url, body)).data,
    async getAll(url) {
      const items = [];
      let next = url;
      while (next) {
        const { data, link } = await request('GET', next);
        items.push(...data);
        next = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
      }
      return items;
    },
  };
}

// A ruleset this script may flip: branch target, default branch only with no
// exclusions (an exclude could drop main, and we'd report a freeze that isn't
// one), and nothing but one required check, "Release freeze", pinned to the app
// this run's token belongs to (Dane: so nobody else can post it, and we can) and
// not requiring PRs to be up to date (so the versioning PR isn't held up when
// main moves).
function isFreezeRuleset(ruleset, appId) {
  const include = ruleset.conditions?.ref_name?.include ?? [];
  const exclude = ruleset.conditions?.ref_name?.exclude;
  const rules = ruleset.rules ?? [];
  const params = rules[0]?.parameters ?? {};
  const checks = params.required_status_checks ?? [];
  return (
    ruleset.target === 'branch' &&
    include.length === 1 &&
    include[0] === '~DEFAULT_BRANCH' &&
    Array.isArray(exclude) &&
    exclude.length === 0 &&
    rules.length === 1 &&
    rules[0].type === 'required_status_checks' &&
    params.strict_required_status_checks_policy === false &&
    checks.length === 1 &&
    checks[0].context === CHECK_NAME &&
    checks[0].integration_id === appId
  );
}

function summarize(text) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

function output(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
  );
}

async function findRulesets(api, repo) {
  const all = await api.getAll(`/repos/${repo}/rulesets?per_page=100&includes_parents=false`);
  return all.filter(r => r.name === RULESET_NAME && r.source_type === 'Repository' && r.source === repo);
}

// Posts a passing "Release freeze" status on the current head of the versioning
// branch. Harmless while unfrozen (the check isn't required then), so it is
// posted on every push to the branch rather than only while frozen: that leaves
// no window where a push lands between reading the freeze and posting.
async function markVersioningHead(api, repo) {
  let branch;
  try {
    branch = await api.get(`/repos/${repo}/branches/${encodeURIComponent(VERSIONING_BRANCH)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      console.log(`No ${VERSIONING_BRANCH} branch; no versioning PR to pass.`);
      return null;
    }
    throw error;
  }
  const sha = branch.commit.sha;
  await api.post(`/repos/${repo}/statuses/${sha}`, {
    state: 'success',
    context: CHECK_NAME,
    description: 'The versioning PR may merge while main is frozen',
  });
  console.log(`Passed "${CHECK_NAME}" on ${VERSIONING_BRANCH} at ${sha}.`);
  return sha;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token) usage('GITHUB_TOKEN is not set');
  if (!repo?.includes('/')) usage('GITHUB_REPOSITORY must be owner/repo');
  const api = makeApi({ baseUrl: process.env.GITHUB_API_URL || 'https://api.github.com', token });

  if (args.action === 'mark') {
    await markVersioningHead(api, repo);
    return;
  }

  if (args.action === 'check') {
    const matches = await findRulesets(api, repo);
    if (matches.length > 1) throw new Error(`${matches.length} rulesets named "${RULESET_NAME}"; keep exactly one.`);
    const frozen = matches[0]?.enforcement === 'active';
    console.log(
      matches.length === 0
        ? `No "${RULESET_NAME}" ruleset; main is not frozen.`
        : `main is ${frozen ? 'frozen' : 'not frozen'} (ruleset ${matches[0].id} enforcement: ${matches[0].enforcement}).`,
    );
    output({ frozen });
    return;
  }

  const target = TARGET[args.action];

  // 1. Only people with write access may freeze or unfreeze main.
  const permission = await api.get(`/repos/${repo}/collaborators/${encodeURIComponent(args.actor)}/permission`);
  if (!ALLOWED_PERMISSIONS.has(permission?.permission)) {
    throw new Error(
      `@${args.actor} has ${permission?.permission ?? 'unknown'} access to ${repo} and is not allowed to ${args.action} main (write access required).`,
    );
  }

  // 2. Find the ruleset by name; repository rulesets only, never an org one.
  const matches = await findRulesets(api, repo);
  if (matches.length === 0)
    throw new Error(`No ruleset named "${RULESET_NAME}" on ${repo}. A repo admin must create it first.`);
  if (matches.length > 1) {
    throw new Error(
      `${matches.length} rulesets named "${RULESET_NAME}" (ids ${matches.map(r => r.id).join(', ')}); keep exactly one.`,
    );
  }
  const id = matches[0].id;
  const path = `/repos/${repo}/rulesets/${id}`;

  // 3. Make sure it is what we think it is before changing it, including that
  // the check is pinned to the app this token belongs to.
  const appSlug = process.env.APP_SLUG;
  if (!appSlug) throw new Error('APP_SLUG is not set; it names the app the "Release freeze" check must be pinned to.');
  const app = await api.get(`/apps/${encodeURIComponent(appSlug)}`);
  if (!Number.isInteger(app?.id) || app.id <= 0) throw new Error(`Could not read the id of app ${appSlug}.`);
  const current = await api.get(path);
  if (!isFreezeRuleset(current, app.id)) {
    const rules = current.rules ?? [];
    throw new Error(
      `Ruleset ${id} "${RULESET_NAME}" is not a main-only "${CHECK_NAME}" required-check ruleset ` +
        `(target ${current.target}, include ${JSON.stringify(current.conditions?.ref_name?.include)}, ` +
        `exclude ${JSON.stringify(current.conditions?.ref_name?.exclude)}, ` +
        `rules ${JSON.stringify(rules.map(r => r.type))}, ` +
        `checks ${JSON.stringify(rules[0]?.parameters?.required_status_checks)}, ` +
        `expected the check pinned to ${appSlug} (app id ${app.id})); refusing to change it.`,
    );
  }

  // 4. Pass the versioning PR before turning the freeze on, so it is never
  // blocked by it. A failure here stops the freeze.
  if (args.action === 'freeze' && !args.dryRun) await markVersioningHead(api, repo);

  let final = current;
  let changed = false;
  if (current.enforcement === target) {
    console.log(`Ruleset ${id} is already ${target}; nothing to change.`);
  } else if (args.dryRun) {
    console.log(`DRY RUN: would PUT ${path} ${JSON.stringify({ enforcement: target })}`);
  } else {
    try {
      await api.put(path, { enforcement: target });
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(`${error.message}\nThe token needs administration: write on ${repo} to edit rulesets.`);
      }
      throw error;
    }
    final = await api.get(path);
    if (final.enforcement !== target) {
      throw new Error(`Ruleset ${id}: expected enforcement ${target}, read back ${final.enforcement}.`);
    }
    changed = true;
  }

  console.log(`${RULESET_NAME} (ruleset ${id}) enforcement: ${final.enforcement}`);
  output({ changed, frozen: final.enforcement === 'active' });
  if (args.dryRun) return;
  const verb = args.action === 'freeze' ? 'frozen' : 'unfrozen';
  const when = new Date().toISOString();
  console.log(`main ${verb} by @${args.actor} at ${when}`);
  summarize(
    args.action === 'freeze'
      ? `### 🔒 main is frozen for a release\n\nFrozen by @${args.actor} at ${when}. Only the versioning PR (${VERSIONING_BRANCH}) can merge to main until it is unfrozen (ruleset "${RULESET_NAME}", id ${id}, enforcement \`active\`).`
      : `### 🔓 main is open again\n\nUnfrozen by @${args.actor} at ${when} (ruleset "${RULESET_NAME}", id ${id}, enforcement \`disabled\`).`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
