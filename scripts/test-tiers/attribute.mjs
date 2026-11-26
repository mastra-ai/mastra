/**
 * Finds the merge that broke a test file tiered `out` (skipped on PRs) once a versioning-PR
 * (changeset-release/*) Prebuild run fails in it, so its author can be told in Slack.
 *
 * update.mjs `versioning --escapes-out` lists the files and jobs that were `out` before the run
 * moved them `in`. `run` then tests the files at main first-parent commits only (never the
 * versioning head or any PR head): at the red commit (the versioning head's parent), at the last
 * green versioning run's parent, then bisects the merges between, and confirms a culprit by a
 * second failing run with its parent passing. It writes the Slack messages; the workflow's
 * notify job posts them. `fallback` writes the message to send when `run` doesn't finish.
 *
 *   node scripts/test-tiers/attribute.mjs run --escapes=<json> --out=<json> [--workdir=<dir>]
 *   node scripts/test-tiers/attribute.mjs fallback --escapes=<json> --tiers-run-url=<url>
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_CANDIDATES = 60;
export const GOOD_RUN_MAX_AGE_HOURS = 72;
// Inside the attribute job's 45-minute timeout, leaving time to look up PRs and write messages.
export const DEADLINE_MINUTES = 38;

/** Files and jobs moved `in` by this run that were `out` before it. */
export function escapedFiles(tiersBefore, moved) {
  const escaped = moved.filter(key => tiersBefore.files[key]?.tier === 'out');
  return {
    files: escaped.filter(key => !key.startsWith('job:')).sort(),
    jobs: escaped.filter(key => key.startsWith('job:')).sort(),
  };
}

/** The latest green run before `run` on its branch, if it is no older than 72 hours. */
export function goodRunFor(runs, run, maxAgeHours = GOOD_RUN_MAX_AGE_HOURS) {
  const oldest = Date.parse(run.created_at) - maxAgeHours * 3_600_000;
  return (
    runs
      .filter(r => r.conclusion === 'success' && r.created_at < run.created_at && Date.parse(r.created_at) >= oldest)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

/** The merges to search, oldest first and ending at the red commit, or why there are none to search. */
export function candidateRange(commits, max = MAX_CANDIDATES) {
  if (commits.length === 0) return { unattributed: 'no merges between the green and the red run' };
  if (commits.length > max) return { unattributed: `more than ${max} merges between the green and the red run` };
  return { commits };
}

/**
 * The next commit to test: the middle of the first unsettled file's range, run for every file
 * whose range holds it. `lo` is the index of the last commit seen passing (-1: the green commit),
 * `hi` of the first seen failing, `skipped` the commits in between that could not be built. When the
 * middle was skipped, the untested commit nearest it (the later one on a tie) is tested instead.
 */
export function nextBisectStep(states) {
  const untested = s => {
    const mid = Math.floor((s.lo + s.hi) / 2);
    const left = [];
    for (let i = s.lo + 1; i < s.hi; i++) if (!s.skipped?.includes(i)) left.push(i);
    return left.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || b - a)[0];
  };
  const open = Object.values(states).find(s => untested(s) !== undefined);
  if (!open) return null;
  const index = untested(open);
  const files = Object.entries(states)
    .filter(([, s]) => s.lo < index && index < s.hi && !s.skipped?.includes(index))
    .map(([file]) => file);
  return { index, files };
}

/** A culprit failed twice and its parent passed; anything less is never tagged. */
export function verdictFor({ culprit, parent }) {
  const fails = culprit.filter(r => r === 'fail').length;
  return fails >= 2 && fails === culprit.length && parent.includes('pass') && parent.every(r => r === 'pass')
    ? 'culprit'
    : 'unconfirmed';
}

/**
 * Bisects `files` over `commits` (oldest first, the red commit last) from the green commit `good`.
 * `runFileAt(sha, files)` resolves to `{ [file]: 'pass' | 'fail' | 'error' }`.
 * @returns {Promise<{ file: string, verdict: string, culprit?: string, parent?: string, reason?: string }[]>}
 */
export async function attribute({ files, good, commits, runFileAt, deadline = Infinity, now = Date.now }) {
  const results = new Map();
  const settle = (file, result) => results.set(file, { file, ...result });
  const outOfTime = () => now() >= deadline;
  const run = async (sha, list, { skippable = false } = {}) => {
    if (outOfTime()) {
      for (const f of list) settle(f, { verdict: 'unconfirmed', reason: 'ran out of time' });
      return null;
    }
    const got = await runFileAt(sha, list);
    for (const f of list) {
      if (got[f] === 'pass' || got[f] === 'fail' || (skippable && got[f] === 'unbuildable')) continue;
      settle(f, {
        verdict: 'unconfirmed',
        reason: got[f] === 'unbuildable' ? `could not build ${sha}` : `could not run the file at ${sha}`,
      });
    }
    return got;
  };
  const bad = commits[commits.length - 1];
  const shaAt = i => (i < 0 ? good : commits[i]);

  const atBad = await run(bad, files);
  let open = files.filter(f => !results.has(f));
  for (const f of open) if (atBad[f] === 'pass') settle(f, { verdict: 'not-reproduced' });
  open = open.filter(f => !results.has(f));

  if (open.length) {
    const atGood = await run(good, open);
    for (const f of open) if (atGood && atGood[f] === 'fail') settle(f, { verdict: 'already-failing' });
  }
  const states = Object.fromEntries(
    open.filter(f => !results.has(f)).map(f => [f, { lo: -1, hi: commits.length - 1, skipped: [], culprit: ['fail'] }]),
  );

  // A merge that doesn't build is skipped, like `git bisect skip`: its neighbours are tested instead.
  for (let step = nextBisectStep(states); step; step = nextBisectStep(states)) {
    const got = await run(shaAt(step.index), step.files, { skippable: true });
    for (const f of step.files) {
      if (results.has(f)) delete states[f];
      else if (got[f] === 'unbuildable') states[f] = { ...states[f], skipped: [...states[f].skipped, step.index] };
      else if (got[f] === 'fail') states[f] = { ...states[f], hi: step.index, culprit: ['fail'] };
      else states[f] = { ...states[f], lo: step.index };
    }
  }

  // The red end of each file's range is rerun to confirm it. With no unbuildable merge left inside
  // the range it is the culprit; otherwise any merge from the first one after `lo` to `hi` may be.
  const byCulprit = Map.groupBy(Object.keys(states), f => states[f].hi);
  for (const [hi, list] of byCulprit) {
    const sha = shaAt(hi);
    const got = await run(sha, list);
    for (const f of list) {
      if (results.has(f)) continue;
      const { lo, skipped } = states[f];
      const verdict = verdictFor({ culprit: [...states[f].culprit, got[f]], parent: ['pass'] });
      const inside = skipped.filter(i => lo < i && i < hi).sort((a, b) => a - b);
      if (verdict !== 'culprit') settle(f, { verdict, reason: `passed when rerun at ${sha}` });
      else if (!inside.length) settle(f, { verdict, culprit: sha, parent: shaAt(hi - 1) });
      else
        settle(f, {
          verdict: 'candidates',
          candidates: commits.slice(lo + 1, hi + 1),
          unbuildable: inside.map(i => commits[i]),
          parent: shaAt(lo),
        });
    }
  }
  return files.map(f => results.get(f));
}

/** The PR a main commit came from: the commit-pulls API, else `(#N)` at the end of the squash subject. */
export function prForCommit(pulls, subject) {
  const pr = pulls.find(p => p.merged_at) ?? pulls[0];
  if (pr) return { number: pr.number, title: pr.title, author: pr.user?.login ?? null, bot: pr.user?.type === 'Bot' };
  const m = /^(.*?)\s*\(#(\d+)\)\s*$/.exec(subject);
  return m ? { number: Number(m[2]), title: m[1], author: null, bot: false } : null;
}

/**
 * Whether to look up who else answers for a culprit PR: a bot opened it, or a person missing from
 * the Slack map did (Dane's `daneatmastra` is a GitHub User, so mapping it would silence this).
 */
export const needsStandIns = (pr, slackUsers) => Boolean(pr?.author && (pr.bot || !slackUsers[pr.author]));

const isBot = user => !user?.login || user.type === 'Bot' || user.login.endsWith('[bot]');

const PR_COMMITS_LIMIT = 250;

const COAUTHOR = /^co-authored-by:.*<(?:\d+\+)?([^@<>\s]+)@users\.noreply\.github\.com>\s*$/gim;

/**
 * Who answers for a PR a bot or a person missing from the Slack map opened: the person who
 * merged it, else every person whose latest review approved it, else the person credited on the
 * most commits (as author or in a Co-authored-by trailer with a GitHub noreply address; ties go
 * to all). None: `logins` is empty.
 * A lookup that failed is passed as null (or undefined for the merger) and its rung is skipped.
 */
export function standIns({ mergedBy, reviews, commits }) {
  if (!isBot(mergedBy)) return { role: 'merged by', logins: [mergedBy.login] };
  const latest = new Map();
  for (const r of reviews ?? []) if (!isBot(r.user) && r.state !== 'COMMENTED') latest.set(r.user.login, r.state);
  const approvers = [...latest].filter(([, state]) => state === 'APPROVED').map(([login]) => login);
  if (approvers.length) return { role: 'approved by', logins: approvers };
  // GitHub lists at most 250 commits for a PR, so a list that long may be cut off.
  if (!commits || commits.length >= PR_COMMITS_LIMIT) return { role: null, logins: [] };
  const credits = new Map();
  for (const c of commits) {
    const people = new Set([...c.commit.message.matchAll(COAUTHOR)].map(m => m[1]));
    if (!isBot(c.author)) people.add(c.author.login);
    for (const login of people) if (!login.endsWith('[bot]')) credits.set(login, (credits.get(login) ?? 0) + 1);
  }
  const most = Math.max(0, ...credits.values());
  const top = [...credits].filter(([, n]) => n === most).map(([login]) => login);
  return most ? { role: 'co-authored by', logins: top } : { role: null, logins: [] };
}

export const escapeMrkdwn = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const code = text => `\`${escapeMrkdwn(text)}\``;

/** One message per culprit PR, one per set of candidate merges, then one for everything that couldn't be pinned on a merge. */
export function alertMessages({ repo, runUrl, good, bad, reason, slackUsers, results, jobs, prs, subjects = {} }) {
  const run = `<${runUrl}|Versioning run>`;
  const messages = [];
  const culprits = Map.groupBy(
    results.filter(r => r.verdict === 'culprit'),
    r => r.culprit,
  );
  for (const [sha, list] of culprits) {
    const pr = prs[sha];
    const files = list.map(r => code(r.file)).join(', ');
    const tag = login => (slackUsers[login] ? `<@${slackUsers[login]}>` : `@${escapeMrkdwn(login)}`);
    const others = pr?.standIns?.logins.filter(login => login !== pr.author) ?? [];
    const stand = others.length ? `, ${pr.standIns.role} ${others.map(tag).join(', ')}` : '';
    const by = !pr?.author
      ? ''
      : pr.bot
        ? ` by ${escapeMrkdwn(pr.author)} (bot)${stand || ', no person found on the PR <!here>'}`
        : slackUsers[pr.author]
          ? ` by ${tag(pr.author)}`
          : ` by ${tag(pr.author)}${stand}`;
    const merge = pr
      ? `<https://github.com/${repo}/pull/${pr.number}|#${pr.number}> "${escapeMrkdwn(pr.title)}"${by}`
      : `<https://github.com/${repo}/commit/${sha}|${sha.slice(0, 7)}>`;
    const them = list.length === 1 ? 'The file now runs' : 'They now run';
    messages.push(
      `Test-tier escape: ${files} (skipped on PRs, no failure in 30 days) started failing on main with ${merge}. ` +
        `Fails on ${code(sha.slice(0, 7))}, passes on its parent. ${run}. ${them} on every PR again for 30 days.`,
    );
  }
  // Several merges may be to blame, so nobody is tagged: the list says which one couldn't be tested.
  const sets = Map.groupBy(
    results.filter(r => r.verdict === 'candidates'),
    r => `${r.candidates.join(' ')}|${r.parent}`,
  );
  for (const list of sets.values()) {
    const { candidates, unbuildable, parent } = list[0];
    const merges = candidates.map(sha => {
      const pr = prs[sha];
      const link = pr
        ? `<https://github.com/${repo}/pull/${pr.number}|#${pr.number}> "${escapeMrkdwn(pr.title)}"`
        : `<https://github.com/${repo}/commit/${sha}|${sha.slice(0, 7)}>${subjects[sha] ? ` "${escapeMrkdwn(subjects[sha])}"` : ''}`;
      return unbuildable.includes(sha) ? `${link} (does not build, so not tested on its own)` : link;
    });
    const files = list.map(r => code(r.file)).join(', ');
    const them = list.length === 1 ? 'The file now runs' : 'They now run';
    const red = candidates[candidates.length - 1];
    messages.push(
      `Test-tier escape: ${files} (skipped on PRs, no failure in 30 days) started failing on main with one of ${merges.join(', ')}. ` +
        `Fails on ${code(red.slice(0, 7))}, passes on ${code(parent.slice(0, 7))}. ${run}. ${them} on every PR again for 30 days.`,
    );
  }
  const left = [
    ...results
      .filter(r => r.verdict === 'unconfirmed')
      .map(r => `${code(r.file)} (${escapeMrkdwn(r.reason ?? 'not confirmed')})`),
    ...jobs.map(j => `${code(j)} (whole job, not bisected)`),
  ];
  if (left.length) {
    const range =
      good && bad
        ? ` Merges in range: <https://github.com/${repo}/compare/${good}...${bad}|${good.slice(0, 7)}...${bad.slice(0, 7)}>.`
        : '';
    const why = reason ? ` (${escapeMrkdwn(reason)})` : '';
    messages.push(
      `Test-tier escape, culprit not found${why}: ${left.join(', ')} skipped on PRs and failed on main.${range} ` +
        `${run}. They now run on every PR again for 30 days.`,
    );
  }
  return messages;
}

// ---------------------------------------------------------------------------------------------
// GitHub and checkout glue (not unit tested; exercised by the replay and in the workflow).

const repo = process.env.GITHUB_REPOSITORY ?? 'mastra-ai/mastra';
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
const { CLICOLOR_FORCE: _color, ...plainEnv } = process.env;
const gh = (...args) => JSON.parse(sh('gh', ['api', ...args], { env: plainEnv }));
/** Every item of a paged list endpoint, not just its first page. */
export const ghAll = (url, run = sh) =>
  JSON.parse(run('gh', ['api', '--paginate', '--slurp', url], { env: plainEnv })).flat();
const git = (...args) => sh('git', args).trim();

/** The main commit a versioning head sits on: its first parent, or failing that its merge base with main. */
function mainCommitUnder(headSha) {
  const parent = gh(`repos/${repo}/commits/${headSha}`).parents[0].sha;
  git('fetch', '--quiet', '--no-tags', '--filter=blob:none', 'origin', 'main', parent);
  try {
    git('merge-base', '--is-ancestor', parent, 'origin/main');
    return parent;
  } catch {
    git('fetch', '--quiet', '--no-tags', '--filter=blob:none', 'origin', headSha);
    return git('merge-base', headSha, 'origin/main');
  }
}

function packageNameFor(dir, file) {
  const parts = file.split('/');
  for (let i = parts.length - 1; i > 0; i--) {
    const pkg = path.join(dir, ...parts.slice(0, i), 'package.json');
    if (fs.existsSync(pkg)) return JSON.parse(fs.readFileSync(pkg, 'utf8')).name;
  }
  return null;
}

/**
 * Runs files at a commit the way CI does: install, build the files' packages and what they depend
 * on (turbo's cache serves unchanged packages), one root vitest run over the unit, typecheck and
 * package E2E projects CI uses, so a file runs in whichever project owns it.
 */
export function checkoutRunner(dir, { log = console.error, exec = sh, deadline = Infinity } = {}) {
  return async (sha, files) => {
    const started = Date.now();
    const all = verdict => Object.fromEntries(files.map(f => [f, verdict]));
    // Each command gets only the time left before the deadline, so a build started late can't run
    // the job into its timeout and lose the files already attributed.
    const opts = () => {
      const left = deadline - Date.now();
      if (left <= 0) throw new Error('ran out of time');
      return { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'], timeout: Number.isFinite(left) ? left : undefined };
    };
    const step = (label, cmd, args) => {
      const t = Date.now();
      exec(cmd, args, opts());
      log(`  ${label}: ${((Date.now() - t) / 1000).toFixed(0)} s`);
    };
    const report = path.join(os.tmpdir(), `attribute-${sha}-${process.pid}-${Date.now()}.json`);
    try {
      step('checkout', 'git', ['checkout', '--quiet', '--detach', '--force', sha]);
      const present = files.filter(f => fs.existsSync(path.join(dir, f)));
      const names = [...new Set(present.map(f => packageNameFor(dir, f)).filter(Boolean))];
      try {
        step('install', 'pnpm', ['install', '--frozen-lockfile', '--prefer-offline']);
        if (names.length) step('build', 'pnpm', ['turbo', 'build', ...names.flatMap(n => ['--filter', `${n}...`])]);
      } catch (error) {
        if (error.code === 'ETIMEDOUT' || error.message === 'ran out of time') throw error;
        // The bisect skips a commit that doesn't install or build; its tests never run on stale output.
        log(
          `  does not build at ${sha}: ${String(error.stderr ?? error.message)
            .trim()
            .slice(-2000)}`,
        );
        return all('unbuildable');
      }
      const t = Date.now();
      try {
        if (present.length)
          exec(
            'pnpm',
            [
              'vitest',
              'run',
              '--project',
              'unit:*',
              '--project',
              'typecheck:*',
              '--project',
              'e2e:packages/*',
              '--project',
              'e2e:client-sdks/*',
              '--reporter=json',
              `--outputFile=${report}`,
              ...present,
            ],
            opts(),
          );
      } catch (error) {
        // vitest exits non-zero when a file fails; the report says which. A run that was cut off
        // or never started has no report to trust.
        if (error.code === 'ETIMEDOUT' || error.message === 'ran out of time') throw error;
      }
      log(`  vitest: ${((Date.now() - t) / 1000).toFixed(0)} s`);
      const results = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')).testResults : [];
      // A file can be reported by more than one project (e.g. unit and typecheck): any failure wins,
      // and it passes only if every result passed. No result at all means it could not run.
      const rank = { pass: 0, error: 1, fail: 2 };
      const status = new Map();
      for (const r of results) {
        const file = path.relative(dir, r.name);
        const s = r.status === 'failed' ? 'fail' : r.status === 'passed' ? 'pass' : 'error';
        if (rank[s] >= rank[status.get(file) ?? 'pass']) status.set(file, s);
      }
      return Object.fromEntries(files.map(f => [f, status.get(f) ?? 'error']));
    } catch (error) {
      log(
        `  could not run at ${sha}: ${String(error.stderr ?? error.message)
          .trim()
          .slice(-2000)}`,
      );
      return all('error');
    } finally {
      fs.rmSync(report, { force: true });
      log(`step ${sha.slice(0, 10)} [${files.join(' ')}]: ${((Date.now() - started) / 1000).toFixed(0)} s`);
    }
  };
}

async function runCommand({ escapes, out, workdir, slackUsers, deadlineMinutes }) {
  const startedAt = Date.now();
  const input = JSON.parse(fs.readFileSync(escapes, 'utf8'));
  const users = slackUsers && fs.existsSync(slackUsers) ? JSON.parse(fs.readFileSync(slackUsers, 'utf8')) : {};
  const runUrl = `https://github.com/${repo}/actions/runs/${input.run_id}`;
  const failing = gh(`repos/${repo}/actions/runs/${input.run_id}`);
  const bad = mainCommitUnder(failing.head_sha);
  const runs = gh(
    `repos/${repo}/actions/workflows/${failing.workflow_id}/runs?branch=${encodeURIComponent(failing.head_branch)}&event=pull_request&per_page=100`,
  ).workflow_runs;
  const goodRun = goodRunFor(runs, failing);
  const good = goodRun ? mainCommitUnder(goodRun.head_sha) : null;
  const range = good
    ? candidateRange(git('rev-list', '--first-parent', '--reverse', `${good}..${bad}`).split('\n').filter(Boolean))
    : { unattributed: `no green versioning run in the last ${GOOD_RUN_MAX_AGE_HOURS} hours` };
  console.error(
    `versioning run ${input.run_id}: red ${bad}, green ${good ?? 'none'}; ${range.commits?.length ?? 0} merges`,
  );

  let results = input.files.map(file => ({ file, verdict: 'unconfirmed' }));
  if (range.commits && input.files.length) {
    const dir = workdir ?? path.join(os.tmpdir(), `attribute-${input.run_id}`);
    if (!fs.existsSync(dir)) git('worktree', 'add', '--detach', dir, bad);
    const deadline = startedAt + Number(deadlineMinutes) * 60_000;
    results = await attribute({
      files: input.files,
      good,
      commits: range.commits,
      runFileAt: checkoutRunner(dir, { deadline }),
      deadline,
    });
  }
  const prs = {};
  for (const r of results.filter(r => r.verdict === 'culprit')) {
    if (r.culprit in prs) continue;
    const subject = git('log', '-1', '--format=%s', r.culprit);
    const pr = prForCommit(gh(`repos/${repo}/commits/${r.culprit}/pulls`), subject);
    if (needsStandIns(pr, users)) {
      const lookup = (what, fn, unknown) => {
        try {
          return fn();
        } catch (error) {
          console.error(`could not read the ${what} of #${pr.number}: ${error.message}`);
          return unknown;
        }
      };
      pr.standIns = standIns({
        mergedBy: lookup('merger', () => gh(`repos/${repo}/pulls/${pr.number}`).merged_by, undefined),
        reviews: lookup('reviews', () => ghAll(`repos/${repo}/pulls/${pr.number}/reviews?per_page=100`), null),
        commits: lookup('commits', () => ghAll(`repos/${repo}/pulls/${pr.number}/commits?per_page=100`), null),
      });
    }
    prs[r.culprit] = pr;
  }
  const subjects = {};
  for (const sha of new Set(results.filter(r => r.verdict === 'candidates').flatMap(r => r.candidates))) {
    if (sha in prs) continue;
    subjects[sha] = git('log', '-1', '--format=%s', sha);
    prs[sha] = prForCommit(gh(`repos/${repo}/commits/${sha}/pulls`), subjects[sha]);
  }
  const messages = alertMessages({
    repo,
    runUrl,
    good,
    bad,
    reason: range.unattributed,
    slackUsers: users,
    results,
    jobs: input.jobs,
    prs,
    subjects,
  });
  for (const r of results)
    console.error(
      `${r.verdict.padEnd(15)} ${r.file}${r.culprit ? ` ${r.culprit}` : ''}${r.candidates ? ` one of ${r.candidates.join(' ')}` : ''}${r.reason ? ` (${r.reason})` : ''}`,
    );
  console.error(`attribution took ${((Date.now() - startedAt) / 1000).toFixed(0)} s`);
  fs.writeFileSync(out, `${JSON.stringify({ run_id: input.run_id, good, bad, results, prs, messages }, null, 2)}\n`);
}

function fallbackCommand({ escapes, tiersRunUrl }) {
  const input = JSON.parse(fs.readFileSync(escapes, 'utf8'));
  const messages = alertMessages({
    repo,
    runUrl: `https://github.com/${repo}/actions/runs/${input.run_id}`,
    reason: `attribution did not finish, see ${tiersRunUrl}`,
    slackUsers: {},
    results: input.files.map(file => ({ file, verdict: 'unconfirmed', reason: 'not bisected' })),
    jobs: input.jobs,
    prs: {},
  });
  process.stdout.write(JSON.stringify(messages));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  const args = {
    escapes: null,
    out: null,
    workdir: null,
    slackUsers: '.github/slack-users.json',
    deadlineMinutes: String(DEADLINE_MINUTES),
    tiersRunUrl: '',
  };
  for (const arg of rest) {
    const m = /^--([a-z-]+)=(.*)$/.exec(arg);
    const key = m?.[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (!m || !(key in args)) throw new Error(`unknown argument ${arg}`);
    args[key] = m[2];
  }
  if (!args.escapes) throw new Error('--escapes=<file> is required');
  if (command === 'run') {
    if (!args.out) throw new Error('--out=<file> is required');
    args.slackUsers = path.resolve(args.slackUsers);
    await runCommand(args);
  } else if (command === 'fallback') {
    fallbackCommand(args);
  } else {
    throw new Error(`unknown command ${command}; use run or fallback`);
  }
}
