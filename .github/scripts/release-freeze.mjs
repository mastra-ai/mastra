#!/usr/bin/env node

// Freezes or unfreezes merges to main during a release by flipping the
// enforcement of the "Release merge freeze" ruleset (rule: Restrict updates).
// While it is active only the ruleset's bypass actors (release owners) can
// update main, so ordinary merges stop rerunning version-packages.yml and
// restarting the versioning PR's CI. Run by .github/workflows/release-freeze.yml.
//
// The ruleset itself is created once by a repo admin; this script only ever
// sends { enforcement } so the bypass list and rules stay as the admin set them.
// It fails closed: an actor without write access, a lookup that
// errors, a missing or duplicated ruleset, or a ruleset that is not a main-only
// "Restrict updates" rule all stop it before any write.
//
// Usage:
//   node release-freeze.mjs --action freeze|unfreeze --actor <login> [--dry-run]
//
// Env: GITHUB_TOKEN (needs administration: write to PUT, metadata read for the
// rest), GITHUB_REPOSITORY, GITHUB_API_URL (default https://api.github.com),
// GITHUB_STEP_SUMMARY (optional).
//
// Exit codes: 0 = ruleset is in the requested state (or would be, on a dry run)
//             1 = refused or failed; nothing was changed unless the PUT itself
//                 succeeded and read back wrong
//             2 = usage error

import { appendFileSync } from 'node:fs';

export const RULESET_NAME = 'Release merge freeze';
// Base permission from the collaborator API: maintain and custom roles built on
// write report "write"; triage reports "read". Write is what GitHub already
// requires to dispatch a workflow, so anyone who can start it may freeze main.
const ALLOWED_PERMISSIONS = new Set(['admin', 'write']);
const TARGET = { freeze: 'active', unfreeze: 'disabled' };

function usage(message) {
  console.error(message);
  console.error('Usage: node release-freeze.mjs --action freeze|unfreeze --actor <login> [--dry-run]');
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
  if (!(args.action in TARGET)) usage(`--action must be freeze or unfreeze, got ${args.action ?? 'nothing'}`);
  if (!args.actor) usage('Missing --actor');
  return args;
}

class ApiError extends Error {}

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
    if (!res.ok) throw new ApiError(`${method} ${url} failed: HTTP ${res.status} ${text.slice(0, 300)}`);
    return { data: text ? JSON.parse(text) : null, link: res.headers.get('link') };
  }

  return {
    get: async url => (await request('GET', url)).data,
    put: async (url, body) => (await request('PUT', url, body)).data,
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
// one), and nothing but the "update" rule, so enforcing it can't switch on
// anything else.
function isFreezeRuleset(ruleset) {
  const include = ruleset.conditions?.ref_name?.include ?? [];
  const exclude = ruleset.conditions?.ref_name?.exclude;
  const rules = ruleset.rules ?? [];
  return (
    ruleset.target === 'branch' &&
    include.length === 1 &&
    include[0] === '~DEFAULT_BRANCH' &&
    Array.isArray(exclude) &&
    exclude.length === 0 &&
    rules.length === 1 &&
    rules[0].type === 'update'
  );
}

function summarize(text) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token) usage('GITHUB_TOKEN is not set');
  if (!repo?.includes('/')) usage('GITHUB_REPOSITORY must be owner/repo');
  const api = makeApi({ baseUrl: process.env.GITHUB_API_URL || 'https://api.github.com', token });
  const target = TARGET[args.action];

  // 1. Only people with write access may freeze or unfreeze main.
  const permission = await api.get(`/repos/${repo}/collaborators/${encodeURIComponent(args.actor)}/permission`);
  if (!ALLOWED_PERMISSIONS.has(permission?.permission)) {
    throw new Error(
      `@${args.actor} has ${permission?.permission ?? 'unknown'} access to ${repo} and is not allowed to ${args.action} main (write access required).`,
    );
  }

  // 2. Find the ruleset by name; repository rulesets only, never an org one.
  const all = await api.getAll(`/repos/${repo}/rulesets?per_page=100&includes_parents=false`);
  const matches = all.filter(r => r.name === RULESET_NAME && r.source_type === 'Repository' && r.source === repo);
  if (matches.length === 0)
    throw new Error(`No ruleset named "${RULESET_NAME}" on ${repo}. A repo admin must create it first.`);
  if (matches.length > 1) {
    throw new Error(
      `${matches.length} rulesets named "${RULESET_NAME}" (ids ${matches.map(r => r.id).join(', ')}); keep exactly one.`,
    );
  }
  const id = matches[0].id;
  const path = `/repos/${repo}/rulesets/${id}`;

  // 3. Make sure it is what we think it is before changing it.
  const current = await api.get(path);
  if (!isFreezeRuleset(current)) {
    throw new Error(
      `Ruleset ${id} "${RULESET_NAME}" is not a main-only "Restrict updates" ruleset ` +
        `(target ${current.target}, include ${JSON.stringify(current.conditions?.ref_name?.include)}, ` +
        `exclude ${JSON.stringify(current.conditions?.ref_name?.exclude)}, ` +
        `rules ${JSON.stringify((current.rules ?? []).map(r => r.type))}); refusing to change it.`,
    );
  }

  let final = current;
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
  }

  console.log(`${RULESET_NAME} (ruleset ${id}) enforcement: ${final.enforcement}`);
  if (args.dryRun) return;
  const verb = args.action === 'freeze' ? 'frozen' : 'unfrozen';
  const when = new Date().toISOString();
  console.log(`main ${verb} by @${args.actor} at ${when}`);
  summarize(
    args.action === 'freeze'
      ? `### 🔒 main is frozen for a release\n\nFrozen by @${args.actor} at ${when}. Only release owners can merge to main until it is unfrozen (ruleset "${RULESET_NAME}", id ${id}, enforcement \`active\`).`
      : `### 🔓 main is open again\n\nUnfrozen by @${args.actor} at ${when} (ruleset "${RULESET_NAME}", id ${id}, enforcement \`disabled\`).`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
