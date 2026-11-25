import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  alertMessages,
  checkoutRunner,
  attribute,
  candidateRange,
  escapedFiles,
  escapeMrkdwn,
  ghAll,
  goodRunFor,
  nextBisectStep,
  needsStandIns,
  prForCommit,
  standIns,
  verdictFor,
} from './attribute.mjs';

const out = { tier: 'out', since: '2026-10-01', last_failure: null, reason: 'seed-rule-b' };
const inn = { tier: 'in', since: '2026-10-01', last_failure: '2026-11-01', reason: 'catch' };

test('only files and jobs that were out before the run escaped', () => {
  const before = {
    files: {
      'packages/core/src/a.test.ts': { ...out },
      'packages/core/src/b.test.ts': { ...inn },
      'job:store/pg': { ...out },
      'job:store/mongodb': { ...inn },
    },
  };
  const moved = [
    'packages/core/src/a.test.ts',
    'packages/core/src/b.test.ts',
    'packages/core/src/new.test.ts',
    'job:store/pg',
    'job:store/mongodb',
  ];
  assert.deepEqual(escapedFiles(before, moved), { files: ['packages/core/src/a.test.ts'], jobs: ['job:store/pg'] });
});

test('the good run is the latest green run on the branch before the failing one, inside 72 hours', () => {
  const run = { id: 9, created_at: '2026-11-16T17:00:00Z' };
  const runs = [
    { id: 1, conclusion: 'success', created_at: '2026-11-13T16:00:00Z' },
    { id: 2, conclusion: 'success', created_at: '2026-11-16T10:00:00Z' },
    { id: 3, conclusion: 'failure', created_at: '2026-11-16T12:00:00Z' },
    { id: 4, conclusion: 'cancelled', created_at: '2026-11-16T13:00:00Z' },
    { id: 9, conclusion: 'failure', created_at: '2026-11-16T17:00:00Z' },
    { id: 10, conclusion: 'success', created_at: '2026-11-16T18:00:00Z' },
  ];
  assert.equal(goodRunFor(runs, run).id, 2);
  assert.equal(
    goodRunFor(
      runs.filter(r => r.id !== 2),
      run,
    ),
    null,
    'the only older green run is past 72 h',
  );
});

test('the candidate range is every merge after good up to bad, capped at 60', () => {
  const shas = Array.from({ length: 61 }, (_, i) => `c${i}`);
  assert.deepEqual(candidateRange(shas.slice(0, 3)), { commits: ['c0', 'c1', 'c2'] });
  assert.deepEqual(candidateRange(shas.slice(0, 60)).commits.length, 60);
  assert.deepEqual(candidateRange(shas), { unattributed: 'more than 60 merges between the green and the red run' });
  assert.deepEqual(candidateRange([]), { unattributed: 'no merges between the green and the red run' });
});

test('a bisect step tests the middle of a range and every file whose range holds that commit', () => {
  const states = {
    a: { lo: -1, hi: 7 },
    b: { lo: -1, hi: 7 },
    c: { lo: 4, hi: 5 },
  };
  assert.deepEqual(nextBisectStep(states), { index: 3, files: ['a', 'b'] });
  assert.deepEqual(nextBisectStep({ a: { lo: 2, hi: 7 }, b: { lo: 4, hi: 7 } }), { index: 4, files: ['a'] });
  assert.equal(nextBisectStep({ a: { lo: 2, hi: 3 } }), null);
});

test('a culprit needs two failing runs and a passing parent', () => {
  assert.equal(verdictFor({ culprit: ['fail', 'fail'], parent: ['pass'] }), 'culprit');
  assert.equal(verdictFor({ culprit: ['fail', 'pass'], parent: ['pass'] }), 'unconfirmed');
  assert.equal(verdictFor({ culprit: ['fail', 'fail'], parent: ['error'] }), 'unconfirmed');
  assert.equal(verdictFor({ culprit: ['fail'], parent: ['pass'] }), 'unconfirmed');
});

/** A fake checkout: each file starts failing at the commit given, or flips per call. */
const fakeRepo = (breaksAt, commits, { flaky = {}, errorAt = [], unbuildableAt = [] } = {}) => {
  const calls = [];
  const runFileAt = async (sha, files) => {
    calls.push({ sha, files: [...files] });
    if (errorAt.includes(sha)) return Object.fromEntries(files.map(f => [f, 'error']));
    if (unbuildableAt.includes(sha)) return Object.fromEntries(files.map(f => [f, 'unbuildable']));
    const at = sha === 'good' ? -1 : commits.indexOf(sha);
    return Object.fromEntries(
      files.map(f => {
        if (flaky[f]) return [f, flaky[f]()];
        return [f, breaksAt[f] !== undefined && at >= breaksAt[f] ? 'fail' : 'pass'];
      }),
    );
  };
  return { runFileAt, calls };
};

test('bisect finds the merge that broke each file, sharing runs between files', async () => {
  const commits = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];
  const { runFileAt, calls } = fakeRepo({ a: 2, b: 2, c: 6 }, commits);
  const results = await attribute({ files: ['a', 'b', 'c'], good: 'good', commits, runFileAt });
  assert.deepEqual(results, [
    { file: 'a', verdict: 'culprit', culprit: 'm2', parent: 'm1' },
    { file: 'b', verdict: 'culprit', culprit: 'm2', parent: 'm1' },
    { file: 'c', verdict: 'culprit', culprit: 'm6', parent: 'm5' },
  ]);
  // bad, good, five bisect runs (m3 is shared by all three files, m1 and m2 by a and b), then one
  // confirmation run per culprit.
  assert.deepEqual(
    calls.map(c => c.sha),
    ['m7', 'good', 'm3', 'm1', 'm2', 'm5', 'm6', 'm2', 'm6'],
  );
  assert.deepEqual(calls[0], { sha: 'm7', files: ['a', 'b', 'c'] });
  assert.deepEqual(calls[1], { sha: 'good', files: ['a', 'b', 'c'] });
});

test('the first merge in the range can be the culprit, with the good commit as its parent', async () => {
  const commits = ['m0', 'm1', 'm2'];
  const { runFileAt } = fakeRepo({ a: 0 }, commits);
  assert.deepEqual(await attribute({ files: ['a'], good: 'good', commits, runFileAt }), [
    { file: 'a', verdict: 'culprit', culprit: 'm0', parent: 'good' },
  ]);
});

test('a file that passes on the red commit is a flake and is never bisected', async () => {
  const commits = ['m0', 'm1'];
  const { runFileAt, calls } = fakeRepo({}, commits);
  assert.deepEqual(await attribute({ files: ['a'], good: 'good', commits, runFileAt }), [
    { file: 'a', verdict: 'not-reproduced' },
  ]);
  assert.equal(calls.length, 1);
});

test('a file that already fails on the green commit is not blamed on a merge', async () => {
  const commits = ['m0', 'm1'];
  const { runFileAt } = fakeRepo({ a: -1 }, commits);
  assert.deepEqual(await attribute({ files: ['a'], good: 'good', commits, runFileAt }), [
    { file: 'a', verdict: 'already-failing' },
  ]);
});

test('a file that stops failing on the confirmation run is unconfirmed, never tagged', async () => {
  const commits = ['m0', 'm1', 'm2', 'm3'];
  // red at bad, green at good, red at m1, green at m0, then green again at m1 on the confirmation run.
  const seq = ['fail', 'pass', 'fail', 'pass', 'pass'];
  const { runFileAt, calls } = fakeRepo({}, commits, { flaky: { a: () => seq.shift() } });
  const [result] = await attribute({ files: ['a'], good: 'good', commits, runFileAt });
  assert.deepEqual(result, { file: 'a', verdict: 'unconfirmed', reason: 'passed when rerun at m1' });
  assert.deepEqual(
    calls.map(c => c.sha),
    ['m3', 'good', 'm1', 'm0', 'm1'],
  );
});

test('a commit where the file could not run leaves it unconfirmed', async () => {
  const commits = ['m0', 'm1', 'm2', 'm3'];
  const { runFileAt } = fakeRepo({ a: 3 }, commits, { errorAt: ['m1'] });
  assert.deepEqual(await attribute({ files: ['a'], good: 'good', commits, runFileAt }), [
    { file: 'a', verdict: 'unconfirmed', reason: 'could not run the file at m1' },
  ]);
});

test('a merge that does not build is skipped and the bisect tests its neighbours instead', async () => {
  const commits = ['m0', 'm1', 'm2', 'm3', 'm4'];
  const { runFileAt, calls } = fakeRepo({ a: 3 }, commits, { unbuildableAt: ['m1'] });
  assert.deepEqual(await attribute({ files: ['a'], good: 'good', commits, runFileAt }), [
    { file: 'a', verdict: 'culprit', culprit: 'm3', parent: 'm2' },
  ]);
  assert.deepEqual(
    calls.map(c => c.sha),
    ['m4', 'good', 'm1', 'm2', 'm3', 'm3'],
  );
});

test('a skip step picks the untested merge nearest the middle, for every file whose range holds it', () => {
  assert.deepEqual(nextBisectStep({ a: { lo: -1, hi: 4, skipped: [1] }, b: { lo: 1, hi: 4 } }), {
    index: 2,
    files: ['a', 'b'],
  });
  assert.deepEqual(nextBisectStep({ a: { lo: -1, hi: 4, skipped: [1, 2] } }), { index: 0, files: ['a'] });
  assert.equal(nextBisectStep({ a: { lo: -1, hi: 2, skipped: [0, 1] } }), null);
});

// Versioning run 44311103514: provider regen 0410aad (no PR, [skip ci]) broke two tests and did not
// build; #30826 (4aa2a60) fixed the build. Every merge between the green and the red commit is a
// candidate once the only untested ones could not be built.
test('when only unbuildable merges are left, the files get the candidate merges instead of nothing', async () => {
  const commits = ['0410aad', '4aa2a60'];
  const { runFileAt, calls } = fakeRepo({ a: 0, b: 0 }, commits, { unbuildableAt: ['0410aad'] });
  assert.deepEqual(await attribute({ files: ['a', 'b'], good: '8f7ac95', commits, runFileAt }), [
    {
      file: 'a',
      verdict: 'candidates',
      candidates: ['0410aad', '4aa2a60'],
      unbuildable: ['0410aad'],
      parent: '8f7ac95',
    },
    {
      file: 'b',
      verdict: 'candidates',
      candidates: ['0410aad', '4aa2a60'],
      unbuildable: ['0410aad'],
      parent: '8f7ac95',
    },
  ]);
  // red, green, the unbuildable middle, then the confirmation rerun at the red end of the range.
  assert.deepEqual(
    calls.map(c => c.sha),
    ['4aa2a60', '8f7ac95', '0410aad', '4aa2a60'],
  );
});

test('candidates still need the red end to fail again on the confirmation run', async () => {
  const commits = ['m0', 'm1'];
  const seq = ['fail', 'pass', 'pass'];
  const { runFileAt } = fakeRepo({}, commits, { flaky: { a: () => seq.shift() }, unbuildableAt: ['m0'] });
  assert.deepEqual(await attribute({ files: ['a'], good: 'good', commits, runFileAt }), [
    { file: 'a', verdict: 'unconfirmed', reason: 'passed when rerun at m1' },
  ]);
});

test('the red or green commit not building still leaves the files unconfirmed', async () => {
  const commits = ['m0', 'm1'];
  for (const at of ['m1', 'good']) {
    const { runFileAt } = fakeRepo({ a: 0 }, commits, { unbuildableAt: [at] });
    assert.deepEqual(await attribute({ files: ['a'], good: 'good', commits, runFileAt }), [
      { file: 'a', verdict: 'unconfirmed', reason: `could not build ${at}` },
    ]);
  }
});

test('files left when the deadline passes are unconfirmed', async () => {
  const commits = ['m0', 'm1', 'm2', 'm3'];
  const { runFileAt, calls } = fakeRepo({ a: 2 }, commits);
  let now = 0;
  const timed = async (sha, files) => {
    now += 10;
    return runFileAt(sha, files);
  };
  const results = await attribute({
    files: ['a'],
    good: 'good',
    commits,
    runFileAt: timed,
    deadline: 15,
    now: () => now,
  });
  assert.deepEqual(results, [{ file: 'a', verdict: 'unconfirmed', reason: 'ran out of time' }]);
  assert.equal(calls.length, 2);
});

test('the culprit PR comes from the commit-pulls API, else from the squash subject', () => {
  const merged = [
    { number: 30434, title: 'fix(client-js): x', user: { login: 'bot[bot]', type: 'Bot' }, merged_at: 'x' },
  ];
  assert.deepEqual(prForCommit(merged, 'ignored (#1)'), {
    number: 30434,
    title: 'fix(client-js): x',
    author: 'bot[bot]',
    bot: true,
  });
  assert.deepEqual(prForCommit([], 'feat(core): y (#29370)'), {
    number: 29370,
    title: 'feat(core): y',
    author: null,
    bot: false,
  });
  assert.equal(prForCommit([], 'no number here'), null);
});

test('Slack text escapes the characters mrkdwn treats as markup', () => {
  assert.equal(escapeMrkdwn('a <b> & <!channel>'), 'a &lt;b&gt; &amp; &lt;!channel&gt;');
});

test('one message per culprit PR; mapped authors are tagged, bots and unmapped are not', () => {
  const ctx = {
    repo: 'mastra-ai/mastra',
    runUrl: 'https://github.com/mastra-ai/mastra/actions/runs/1',
    good: 'g000000000',
    bad: 'b000000000',
    slackUsers: { tony: 'U123' },
  };
  const results = [
    { file: 'packages/core/a.test.ts', verdict: 'culprit', culprit: 'c1111111111', parent: 'p' },
    { file: 'packages/core/b.test.ts', verdict: 'culprit', culprit: 'c1111111111', parent: 'p' },
    { file: 'packages/playground/c.test.tsx', verdict: 'culprit', culprit: 'c2222222222', parent: 'p' },
    { file: 'packages/core/flaky.test.ts', verdict: 'not-reproduced' },
  ];
  const prs = {
    c1111111111: { number: 29370, title: 'feat: <storage> & v2', author: 'tony', bot: false },
    c2222222222: { number: 30434, title: 'fix(client-js): retries', author: 'mastra-platform[bot]', bot: true },
  };
  const messages = alertMessages({ ...ctx, results, jobs: [], prs });
  assert.equal(messages.length, 2);
  assert.match(messages[0], /`packages\/core\/a\.test\.ts`, `packages\/core\/b\.test\.ts`/);
  assert.match(
    messages[0],
    /<https:\/\/github\.com\/mastra-ai\/mastra\/pull\/29370\|#29370> "feat: &lt;storage&gt; &amp; v2" by <@U123>/,
  );
  assert.match(messages[0], /Fails on `c111111`, passes on its parent/);
  assert.match(messages[1], /by mastra-platform\[bot\] \(bot\)/);
  assert.doesNotMatch(messages.join('\n'), /flaky/);

  const unmapped = alertMessages({ ...ctx, slackUsers: {}, results: results.slice(0, 1), jobs: [], prs });
  assert.match(unmapped[0], /by @tony\./);
});

test('an unmapped person who opened the PR is named, and whoever merged it is tagged', () => {
  const ctx = {
    repo: 'mastra-ai/mastra',
    runUrl: 'https://run',
    good: 'g000000000',
    bad: 'b000000000',
    results: [{ file: 'a.test.ts', verdict: 'culprit', culprit: 'c1111111111', parent: 'p' }],
    jobs: [],
  };
  const pr = { number: 1, title: 't', author: 'daneatmastra', bot: false };
  const [merged] = alertMessages({
    ...ctx,
    slackUsers: { NikAiyer: 'U085YNHJM7Y' },
    prs: { c1111111111: { ...pr, standIns: { role: 'merged by', logins: ['NikAiyer'] } } },
  });
  assert.match(merged, /by @daneatmastra, merged by <@U085YNHJM7Y>\./);

  const [unmappedMerger] = alertMessages({
    ...ctx,
    slackUsers: {},
    prs: { c1111111111: { ...pr, standIns: { role: 'merged by', logins: ['NikAiyer'] } } },
  });
  assert.match(unmappedMerger, /by @daneatmastra, merged by @NikAiyer\./);

  const [selfMerged] = alertMessages({
    ...ctx,
    slackUsers: {},
    prs: { c1111111111: { ...pr, standIns: { role: 'merged by', logins: ['daneatmastra'] } } },
  });
  assert.match(selfMerged, /by @daneatmastra\./);

  const [nobody] = alertMessages({
    ...ctx,
    slackUsers: {},
    prs: { c1111111111: { ...pr, standIns: { role: null, logins: [] } } },
  });
  assert.match(nobody, /by @daneatmastra\./);
  assert.doesNotMatch(nobody, /<!here>/);
});

test('stand-ins are looked up for bot PRs and unmapped authors only', () => {
  const users = { tony: 'U1' };
  assert.equal(needsStandIns({ author: 'mastra-platform[bot]', bot: true }, users), true);
  assert.equal(needsStandIns({ author: 'daneatmastra', bot: false }, users), true);
  assert.equal(needsStandIns({ author: 'tony', bot: false }, users), false);
  assert.equal(needsStandIns({ author: null, bot: false }, users), false);
  assert.equal(needsStandIns(null, users), false);
});

test('a mapped person who opened the PR is tagged alone', () => {
  const [message] = alertMessages({
    repo: 'mastra-ai/mastra',
    runUrl: 'https://run',
    slackUsers: { tony: 'U1', NikAiyer: 'U085YNHJM7Y' },
    results: [{ file: 'a.test.ts', verdict: 'culprit', culprit: 'c1111111111', parent: 'p' }],
    jobs: [],
    prs: {
      c1111111111: {
        number: 1,
        title: 't',
        author: 'tony',
        bot: false,
        standIns: { role: 'merged by', logins: ['NikAiyer'] },
      },
    },
  });
  assert.match(message, /by <@U1>\./);
});

test('the Slack map tags Nik and the active committers found in Slack', () => {
  const users = JSON.parse(fs.readFileSync(new URL('../../.github/slack-users.json', import.meta.url), 'utf8'));
  assert.equal(users.NikAiyer, 'U085YNHJM7Y');
  assert.equal(users['shreyas-mastra'], 'U0BVCSJ18MR');
  assert.equal(users.YujohnNattrass, 'U08C10D1ETH');
  assert.equal(users.PaulieScanlon, 'U08SDV7MY05');
  assert.equal(users.labifrancis, 'U0BA2UQG7GU');
  assert.equal(users.internetburrito, 'U0B583A0LR5');
});

test('unconfirmed files and escaped jobs go in one unattributed message with the range', () => {
  const messages = alertMessages({
    repo: 'mastra-ai/mastra',
    runUrl: 'https://run',
    good: 'g000000000',
    bad: 'b000000000',
    slackUsers: {},
    results: [
      { file: 'a.test.ts', verdict: 'unconfirmed', reason: 'ran out of time' },
      { file: 'b.test.ts', verdict: 'already-failing' },
    ],
    jobs: ['job:store/pg'],
    prs: {},
  });
  assert.equal(messages.length, 1);
  assert.match(messages[0], /culprit not found/);
  assert.match(messages[0], /`a\.test\.ts` \(ran out of time\), `job:store\/pg` \(whole job, not bisected\)/);
  assert.match(
    messages[0],
    /<https:\/\/github\.com\/mastra-ai\/mastra\/compare\/g000000000\.\.\.b000000000\|g000000\.\.\.b000000>/,
  );
});

test('candidate merges are listed with their PRs or subjects, without tagging anyone', () => {
  const [message] = alertMessages({
    repo: 'mastra-ai/mastra',
    runUrl: 'https://run',
    good: '8f7ac9531dda',
    bad: '4aa2a601665',
    slackUsers: { wardpeet: 'U1' },
    results: ['a.test.ts', 'b.test.ts'].map(file => ({
      file,
      verdict: 'candidates',
      candidates: ['0410aadf076', '4aa2a601665'],
      unbuildable: ['0410aadf076'],
      parent: '8f7ac9531dda',
    })),
    jobs: [],
    prs: {
      '0410aadf076': null,
      '4aa2a601665': { number: 30826, title: 'fix(core): fix TS2590 <!here>', author: 'wardpeet', bot: false },
    },
    subjects: { '0410aadf076': 'chore: regenerate providers, docs and pricing [skip ci]' },
  });
  assert.equal(
    message,
    'Test-tier escape: `a.test.ts`, `b.test.ts` (skipped on PRs, no failure in 30 days) started failing on main with one of ' +
      '<https://github.com/mastra-ai/mastra/commit/0410aadf076|0410aad> "chore: regenerate providers, docs and pricing [skip ci]" (does not build, so not tested on its own), ' +
      '<https://github.com/mastra-ai/mastra/pull/30826|#30826> "fix(core): fix TS2590 &lt;!here&gt;". ' +
      'Fails on `4aa2a60`, passes on `8f7ac95`. <https://run|Versioning run>. They now run on every PR again for 30 days.',
  );
});

test('without a range the unattributed message still names the files and the run', () => {
  const [message] = alertMessages({
    repo: 'mastra-ai/mastra',
    runUrl: 'https://run',
    reason: 'no green versioning run in the last 72 hours',
    slackUsers: {},
    results: [{ file: 'a.test.ts', verdict: 'unconfirmed' }],
    jobs: [],
    prs: {},
  });
  assert.match(message, /`a\.test\.ts`/);
  assert.match(message, /no green versioning run in the last 72 hours/);
  assert.match(message, /<https:\/\/run\|Versioning run>/);
});

const human = login => ({ login, type: 'User' });
const botUser = login => ({ login, type: 'Bot' });
const commit = (author, message = 'x') => ({ author, commit: { message } });
const noreply = (id, login) => `Co-authored-by: Someone <${id}+${login}@users.noreply.github.com>`;

test('a bot-opened PR is pinned on whoever merged it when that was a person', () => {
  assert.deepEqual(standIns({ mergedBy: human('abhiaiyer91'), reviews: [], commits: [] }), {
    role: 'merged by',
    logins: ['abhiaiyer91'],
  });
});

test('then on every person whose latest review approved it', () => {
  const reviews = [
    { user: botUser('coderabbitai[bot]'), state: 'APPROVED' },
    { user: human('ana'), state: 'APPROVED' },
    { user: human('ben'), state: 'APPROVED' },
    { user: human('ben'), state: 'DISMISSED' },
    { user: human('cy'), state: 'CHANGES_REQUESTED' },
    { user: human('cy'), state: 'APPROVED' },
    { user: human('cy'), state: 'COMMENTED' },
  ];
  assert.deepEqual(standIns({ mergedBy: botUser('mergify[bot]'), reviews, commits: [] }), {
    role: 'approved by',
    logins: ['ana', 'cy'],
  });
});

test('then on the person credited on the most commits (author or Co-authored-by trailer), ties to all', () => {
  const commits = [
    commit(botUser('mastra-platform[bot]'), `fix\n\n${noreply(1, 'dee')}\n${noreply(9, 'mastra-platform[bot]')}`),
    commit(human('eve'), `more\n\n${noreply(1, 'dee')}`),
    commit(botUser('mastra-platform[bot]'), 'Co-authored-by: Nobody <nobody@example.com>'),
  ];
  assert.deepEqual(standIns({ mergedBy: null, reviews: [], commits }), { role: 'co-authored by', logins: ['dee'] });
  commits.push(commit(human('eve')));
  assert.deepEqual(standIns({ mergedBy: null, reviews: [], commits }), {
    role: 'co-authored by',
    logins: ['dee', 'eve'],
  });
});

test('with no person anywhere there is nobody to stand in', () => {
  const commits = [commit(botUser('renovate[bot]'))];
  assert.deepEqual(standIns({ mergedBy: botUser('renovate[bot]'), reviews: [], commits }), {
    role: null,
    logins: [],
  });
});

test('a bot PR tags its stand-ins, or @here when there are none; a title cannot inject @here', () => {
  const ctx = {
    repo: 'mastra-ai/mastra',
    runUrl: 'https://run',
    good: 'g000000000',
    bad: 'b000000000',
    slackUsers: { abhiaiyer91: 'U9' },
    jobs: [],
  };
  const results = [{ file: 'a.test.ts', verdict: 'culprit', culprit: 'c1111111111', parent: 'p' }];
  const pr = { number: 30434, title: 'retries <!here>', author: 'mastra-platform[bot]', bot: true };
  const [merged] = alertMessages({
    ...ctx,
    results,
    prs: { c1111111111: { ...pr, standIns: { role: 'merged by', logins: ['abhiaiyer91'] } } },
  });
  assert.match(merged, /"retries &lt;!here&gt;" by mastra-platform\[bot\] \(bot\), merged by <@U9>\./);
  assert.doesNotMatch(merged, /<!here>/);

  const [approved] = alertMessages({
    ...ctx,
    results,
    prs: { c1111111111: { ...pr, standIns: { role: 'approved by', logins: ['ana', 'abhiaiyer91'] } } },
  });
  assert.match(approved, /\(bot\), approved by @ana, <@U9>\./);

  const [nobody] = alertMessages({
    ...ctx,
    results,
    prs: { c1111111111: { ...pr, standIns: { role: null, logins: [] } } },
  });
  assert.match(nobody, /\(bot\), no person found on the PR <!here>\./);
  assert.equal(nobody.match(/<!here>/g).length, 1);
});

function runnerFixture(files, report) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attribute-runner-'));
  fs.mkdirSync(path.join(dir, 'packages/core/src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'packages/core/package.json'), JSON.stringify({ name: '@mastra/core' }));
  for (const f of files) fs.writeFileSync(path.join(dir, f), '');
  const calls = [];
  const exec = (cmd, args) => {
    calls.push([cmd, ...args]);
    const out = args.find(a => a.startsWith('--outputFile='));
    if (out) {
      const testResults = report.map(([f, status]) => ({ name: path.join(dir, f), status }));
      fs.writeFileSync(out.slice('--outputFile='.length), JSON.stringify({ testResults }));
      if (report.some(([, status]) => status === 'failed')) throw new Error('vitest exited 1');
    }
    return '';
  };
  return { dir, calls, exec };
}

test('the runner counts a file as failing when any project that ran it failed', async () => {
  const file = 'packages/core/src/a.test.ts';
  for (const report of [
    [
      [file, 'failed'],
      [file, 'passed'],
    ],
    [
      [file, 'passed'],
      [file, 'failed'],
    ],
  ]) {
    const { dir, exec } = runnerFixture([file], report);
    const got = await checkoutRunner(dir, { exec, log: () => {} })('c'.repeat(40), [file]);
    assert.deepEqual(got, { [file]: 'fail' });
  }
  const { dir, exec } = runnerFixture(
    [file],
    [
      [file, 'passed'],
      [file, 'passed'],
    ],
  );
  assert.deepEqual(await checkoutRunner(dir, { exec, log: () => {} })('c'.repeat(40), [file]), { [file]: 'pass' });
  // Passing in one project and not running in another is not a pass.
  for (const report of [
    [
      [file, 'passed'],
      [file, 'skipped'],
    ],
    [
      [file, 'skipped'],
      [file, 'passed'],
    ],
  ]) {
    const { dir, exec } = runnerFixture([file], report);
    const got = await checkoutRunner(dir, { exec, log: () => {} })('c'.repeat(40), [file]);
    assert.deepEqual(got, { [file]: 'error' }, JSON.stringify(report));
  }
});

test('the runner runs package E2E files in their e2e project, and a file no project ran is an error', async () => {
  const e2e = 'packages/core/src/b.e2e.test.ts';
  const gone = 'packages/core/src/gone.test.ts';
  const { dir, calls, exec } = runnerFixture([e2e], [[e2e, 'failed']]);
  const got = await checkoutRunner(dir, { exec, log: () => {} })('c'.repeat(40), [e2e, gone]);
  assert.deepEqual(got, { [e2e]: 'fail', [gone]: 'error' });
  const vitest = calls.find(c => c.includes('vitest'));
  const cmd = vitest.join(' ');
  assert.ok(cmd.includes('--project e2e:packages/* --project e2e:client-sdks/*'), cmd);
  assert.ok(vitest.includes(e2e));
  assert.ok(!vitest.includes(gone));
  assert.ok(calls.some(c => c.join(' ') === 'pnpm turbo build --filter @mastra/core...'));
});

test('PR reviews and commits are read across every page', () => {
  const calls = [];
  const run = (cmd, args) => {
    calls.push([cmd, ...args]);
    const page1 = Array.from({ length: 100 }, () => ({ user: human('ana'), state: 'APPROVED' }));
    return JSON.stringify([page1, [{ user: human('ana'), state: 'CHANGES_REQUESTED' }]]);
  };
  const reviews = ghAll('repos/o/r/pulls/1/reviews?per_page=100', run);
  assert.deepEqual(calls, [['gh', 'api', '--paginate', '--slurp', 'repos/o/r/pulls/1/reviews?per_page=100']]);
  assert.equal(reviews.length, 101);
  // ana's last word was changes requested, so she is not an approver; nobody else is either.
  assert.deepEqual(standIns({ mergedBy: null, reviews, commits: [] }), { role: null, logins: [] });

  const commits = [...Array.from({ length: 100 }, () => commit(botUser('mastra-platform[bot]'))), commit(human('dee'))];
  assert.deepEqual(standIns({ mergedBy: null, reviews: [], commits }), { role: 'co-authored by', logins: ['dee'] });
});

test('a lookup that failed or was cut off is unknown: that rung is skipped, never guessed from', () => {
  const approvals = [{ user: human('ana'), state: 'APPROVED' }];
  // merged_by unknown: fall through to the approvers.
  assert.deepEqual(standIns({ mergedBy: undefined, reviews: approvals, commits: [] }), {
    role: 'approved by',
    logins: ['ana'],
  });
  // reviews unknown: fall through to commits.
  assert.deepEqual(standIns({ mergedBy: null, reviews: null, commits: [commit(human('dee'))] }), {
    role: 'co-authored by',
    logins: ['dee'],
  });
  // GitHub lists at most 250 commits per PR; a full list may be cut off, so it is unknown.
  const capped = Array.from({ length: 250 }, () => commit(human('dee')));
  assert.deepEqual(standIns({ mergedBy: null, reviews: [], commits: capped }), { role: null, logins: [] });
  assert.deepEqual(standIns({ mergedBy: null, reviews: null, commits: null }), { role: null, logins: [] });
});

test('the runner gives every command only the time left, and runs nothing once it is gone', async () => {
  const file = 'packages/core/src/a.test.ts';
  const { dir, exec } = runnerFixture([file], [[file, 'passed']]);
  const timeouts = [];
  const timed = (cmd, args, opts) => {
    timeouts.push(opts.timeout);
    return exec(cmd, args, opts);
  };
  const deadline = Date.now() + 60_000;
  assert.deepEqual(await checkoutRunner(dir, { exec: timed, log: () => {}, deadline })('c'.repeat(40), [file]), {
    [file]: 'pass',
  });
  assert.equal(timeouts.length, 4);
  for (const t of timeouts) assert.ok(t > 0 && t <= 60_000, String(t));

  const late = [];
  const got = await checkoutRunner(dir, {
    exec: (...a) => late.push(a),
    log: () => {},
    deadline: Date.now() - 1,
  })('c'.repeat(40), [file]);
  assert.deepEqual(got, { [file]: 'error' });
  assert.equal(late.length, 0);
});

test('a vitest run cut off by the deadline is an error, even if a partial report says pass', async () => {
  const file = 'packages/core/src/a.test.ts';
  const { dir, exec } = runnerFixture([file], [[file, 'passed']]);
  const cutOff = (cmd, args, opts) => {
    exec(cmd, args, opts);
    if (args.includes('vitest')) throw Object.assign(new Error('spawnSync pnpm ETIMEDOUT'), { code: 'ETIMEDOUT' });
    return '';
  };
  const got = await checkoutRunner(dir, { exec: cutOff, log: () => {}, deadline: Date.now() + 60_000 })(
    'c'.repeat(40),
    [file],
  );
  assert.deepEqual(got, { [file]: 'error' });
});

test('an install or build that fails is unbuildable; a checkout failure or timeout is an error', async () => {
  const file = 'packages/core/src/a.test.ts';
  const failing = (failOn, error = new Error('exited 2')) => {
    const { dir, calls, exec } = runnerFixture([file], [[file, 'failed']]);
    const run = (cmd, args, opts) => {
      if (args.includes(failOn)) throw error;
      return exec(cmd, args, opts);
    };
    return { dir, calls, run };
  };
  for (const step of ['install', 'build']) {
    const { dir, calls, run } = failing(step);
    assert.deepEqual(await checkoutRunner(dir, { exec: run, log: () => {} })('c'.repeat(40), [file]), {
      [file]: 'unbuildable',
    });
    assert.ok(!calls.some(c => c.includes('vitest')), step);
  }
  const checkout = failing('checkout');
  assert.deepEqual(await checkoutRunner(checkout.dir, { exec: checkout.run, log: () => {} })('c'.repeat(40), [file]), {
    [file]: 'error',
  });
  const slow = failing('build', Object.assign(new Error('spawnSync pnpm ETIMEDOUT'), { code: 'ETIMEDOUT' }));
  assert.deepEqual(
    await checkoutRunner(slow.dir, { exec: slow.run, log: () => {}, deadline: Date.now() + 60_000 })('c'.repeat(40), [
      file,
    ]),
    { [file]: 'error' },
  );
});
