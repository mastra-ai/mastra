import { Octokit } from 'octokit';

const OWNER = requireEnv('OWNER');
const REPO = requireEnv('REPO');
const PR_NUMBER = Number(requireEnv('PR_NUMBER'));
const GITHUB_TOKEN = requireEnv('GITHUB_TOKEN');

const COMMENT_MARKER = '<!-- mastra-pr-automation -->';
const LEGACY_COMMENT_MARKERS = ['<!-- mastra-pr-issue-link -->', '<!-- mastra-pr-complexity -->'];

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function main() {
  if (!Number.isInteger(PR_NUMBER) || PR_NUMBER < 1) {
    throw new Error('PR_NUMBER must be a positive integer');
  }

  const testSummary = await buildChangedTestSummary();
  const body = buildComment([process.env.ISSUE_SUMMARY, process.env.COMPLEXITY_SUMMARY, testSummary]);

  await upsertComment(body);
  await deleteLegacyComments();
}

function buildComment(sections: Array<string | undefined>) {
  const body = sections
    .map(section => section?.trim())
    .filter((section): section is string => Boolean(section))
    .join('\n\n---\n\n');

  return `${COMMENT_MARKER}
${body}`;
}

async function buildChangedTestSummary() {
  const labels = await listIssueLabels();

  if (labels.includes('tests: green ✅')) {
    return '## Changed test gate\n\nChanged tests failed against the base branch as expected.\n\nLabel: `tests: green ✅`';
  }

  if (labels.includes('tests: failing ❌')) {
    return '## Changed test gate\n\nChanged tests passed against the base branch; they should fail before the PR code is applied.\n\nLabel: `tests: failing ❌`';
  }

  if (labels.includes('tests: no tests added')) {
    return '## Changed test gate\n\nNo changed test files were detected.\n\nLabel: `tests: no tests added`';
  }

  return '## Changed test gate\n\nChanged Test Gate is pending. The `Changed Test Gate / changed-tests` check will update the test label when it completes.';
}

async function upsertComment(body: string) {
  const comments = await listComments();
  const existing = comments.find(comment => comment.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({ owner: OWNER, repo: REPO, comment_id: existing.id, body });
    console.log(`Updated PR automation comment on #${PR_NUMBER}`);
    return;
  }

  await octokit.rest.issues.createComment({ owner: OWNER, repo: REPO, issue_number: PR_NUMBER, body });
  console.log(`Created PR automation comment on #${PR_NUMBER}`);
}

async function deleteLegacyComments() {
  const comments = await listComments();
  const legacyComments = comments.filter(comment =>
    LEGACY_COMMENT_MARKERS.some(marker => comment.body?.includes(marker)),
  );

  for (const comment of legacyComments) {
    await octokit.rest.issues.deleteComment({ owner: OWNER, repo: REPO, comment_id: comment.id });
    console.log(`Deleted legacy automation comment ${comment.id} on #${PR_NUMBER}`);
  }
}

async function listComments() {
  return octokit.paginate(octokit.rest.issues.listComments, {
    owner: OWNER,
    repo: REPO,
    issue_number: PR_NUMBER,
    per_page: 100,
  });
}

async function listIssueLabels() {
  const { data: issue } = await octokit.rest.issues.get({ owner: OWNER, repo: REPO, issue_number: PR_NUMBER });

  return issue.labels
    .map(label => (typeof label === 'string' ? label : label.name))
    .filter((name): name is string => Boolean(name));
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
