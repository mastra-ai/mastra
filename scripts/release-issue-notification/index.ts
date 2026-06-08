import { Octokit } from 'octokit';

const OWNER = requireEnv('OWNER');
const REPO = requireEnv('REPO');
const GITHUB_TOKEN = requireEnv('GITHUB_TOKEN');
const MODE = process.env.MODE ?? 'pending-release';
const PR_NUMBER = process.env.PR_NUMBER;

const PENDING_RELEASE_LABEL = 'pending-release';
const PENDING_RELEASE_LABEL_COLOR = 'ededed';
const PENDING_CLOSE_LABEL = 'status: pending-close';
const PENDING_CLOSE_LABEL_COLOR = 'ededed';
const COMMENT_MARKER = '<!-- mastra-release-notification -->';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

type LinkedIssue = {
  number: number;
  title: string;
  url: string;
};

async function main() {
  if (MODE === 'pending-release') {
    if (!PR_NUMBER) {
      throw new Error('PR_NUMBER is required in pending-release mode');
    }
    await pendingRelease(Number(PR_NUMBER));
    return;
  }

  if (MODE === 'alpha-released') {
    await alphaReleased();
    return;
  }

  if (MODE === 'stable-released') {
    await stableReleased();
    return;
  }

  throw new Error(`Unknown MODE "${MODE}". Expected "pending-release", "alpha-released", or "stable-released".`);
}

async function pendingRelease(prNumber: number) {
  const linkedIssues = await getLinkedIssues(prNumber);

  if (linkedIssues.length === 0) {
    console.log(`PR #${prNumber} has no linked issues`);
    return;
  }

  console.log(`PR #${prNumber} links ${linkedIssues.length} issue(s)`);

  await ensurePendingReleaseLabel();

  for (const issue of linkedIssues) {
    await addLabel(issue.number, PENDING_RELEASE_LABEL);
    await upsertReleaseComment(
      issue.number,
      `This issue has been resolved in PR #${prNumber} and will be included in the next release.`,
    );
    console.log(`Added pending-release label and comment to issue #${issue.number}`);
  }
}

async function alphaReleased() {
  const issues = await listIssuesWithLabel(PENDING_RELEASE_LABEL, 'all');
  console.log(`Found ${issues.length} issue(s) with ${PENDING_RELEASE_LABEL} label`);

  for (const issue of issues) {
    await upsertReleaseComment(
      issue.number,
      `This issue has been resolved and is available in the **alpha** channel. Install with \`npm install <package>@alpha\`.`,
    );
    console.log(`Updated comment on issue #${issue.number} (alpha released)`);
  }
}

async function ensurePendingCloseLabel() {
  try {
    await octokit.rest.issues.createLabel({
      owner: OWNER,
      repo: REPO,
      name: PENDING_CLOSE_LABEL,
      color: PENDING_CLOSE_LABEL_COLOR,
      description: 'Issue is fixed in stable but still open — needs manual review/close',
    });
    console.log(`Created label ${PENDING_CLOSE_LABEL}`);
  } catch (error) {
    if (isOctokitError(error, 422)) {
      await octokit.rest.issues.updateLabel({
        owner: OWNER,
        repo: REPO,
        name: PENDING_CLOSE_LABEL,
        color: PENDING_CLOSE_LABEL_COLOR,
        description: 'Issue is fixed in stable but still open — needs manual review/close',
      });
      console.log(`Updated label ${PENDING_CLOSE_LABEL}`);
      return;
    }

    throw error;
  }
}

async function stableReleased() {
  const issues = await listIssuesWithLabel(PENDING_RELEASE_LABEL, 'all');
  console.log(`Found ${issues.length} issue(s) with ${PENDING_RELEASE_LABEL} label`);

  await ensurePendingCloseLabel();

  const message = 'This issue has been resolved and is available in the **latest stable** release.';

  for (const issue of issues) {
    await upsertReleaseComment(issue.number, message);
    await removeLabelIfPresent(issue.number, PENDING_RELEASE_LABEL);

    // If the issue is still open, add pending-close label for manual triage
    if (issue.state === 'open') {
      await addLabel(issue.number, PENDING_CLOSE_LABEL);
      console.log(`Updated comment, removed pending-release, added pending-close on open issue #${issue.number}`);
    } else {
      console.log(`Updated comment and removed pending-release label from closed issue #${issue.number}`);
    }
  }
}

async function getLinkedIssues(prNumber: number): Promise<LinkedIssue[]> {
  const result = await octokit.graphql<{
    repository: {
      pullRequest: {
        closingIssuesReferences: {
          nodes: LinkedIssue[];
        };
      } | null;
    } | null;
  }>(
    `query($owner: String!, $repo: String!, $prNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          closingIssuesReferences(first: 10) {
            nodes { number title url }
          }
        }
      }
    }`,
    { owner: OWNER, repo: REPO, prNumber },
  );

  return result.repository?.pullRequest?.closingIssuesReferences.nodes ?? [];
}

async function listIssuesWithLabel(label: string, state: 'open' | 'closed' | 'all') {
  return octokit.paginate(octokit.rest.issues.listForRepo, {
    owner: OWNER,
    repo: REPO,
    state,
    labels: label,
    per_page: 100,
  });
}

async function upsertReleaseComment(issueNumber: number, message: string) {
  const comments = await listIssueComments(issueNumber);
  const existing = comments.find(comment => comment.body?.includes(COMMENT_MARKER));
  const body = `${COMMENT_MARKER}\n${message}`;

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner: OWNER,
      repo: REPO,
      comment_id: existing.id,
      body,
    });
    console.log(`Updated release notification comment on issue #${issueNumber}`);
    return;
  }

  await octokit.rest.issues.createComment({
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    body,
  });
  console.log(`Created release notification comment on issue #${issueNumber}`);
}

async function listIssueComments(issueNumber: number) {
  return octokit.paginate(octokit.rest.issues.listComments, {
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    per_page: 100,
  });
}

async function ensurePendingReleaseLabel() {
  try {
    await octokit.rest.issues.createLabel({
      owner: OWNER,
      repo: REPO,
      name: PENDING_RELEASE_LABEL,
      color: PENDING_RELEASE_LABEL_COLOR,
      description: 'Issue is fixed but not yet released',
    });
    console.log(`Created label ${PENDING_RELEASE_LABEL}`);
  } catch (error) {
    if (isOctokitError(error, 422)) {
      await octokit.rest.issues.updateLabel({
        owner: OWNER,
        repo: REPO,
        name: PENDING_RELEASE_LABEL,
        color: PENDING_RELEASE_LABEL_COLOR,
        description: 'Issue is fixed but not yet released',
      });
      console.log(`Updated label ${PENDING_RELEASE_LABEL}`);
      return;
    }

    throw error;
  }
}

async function addLabel(issueNumber: number, label: string) {
  await octokit.rest.issues.addLabels({
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    labels: [label],
  });
}

async function removeLabelIfPresent(issueNumber: number, label: string) {
  try {
    await octokit.rest.issues.removeLabel({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      name: label,
    });
    console.log(`Removed label ${label} from #${issueNumber}`);
  } catch (error) {
    if (isOctokitError(error, 404)) {
      return;
    }

    throw error;
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function isOctokitError(error: unknown, status: number) {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === status;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
